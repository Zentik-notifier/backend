import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Header,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemAccessTokenGuard } from '../system-access-token/system-access-token.guard';
import { GetSystemAccessToken } from '../system-access-token/decorators/get-system-access-token.decorator';
import { SystemAccessTokenService } from '../system-access-token/system-access-token.service';
import { ServerSetting, ServerSettingType } from '../entities/server-setting.entity';
import { BackupInfoDto, UpdateServerSettingDto } from './dto';
import { BackupResult, ServerManagerService } from './server-manager.service';
import { ServerSettingsService } from './server-settings.service';
import { LogStorageService } from './log-storage.service';
import { LokiLoggerService } from './loki-logger.service';
import { GetLogsInput, PaginatedLogs } from './dto/get-logs.dto';
import { PrometheusService } from './prometheus.service';

@ApiTags('Server Manager')
@Controller('server-manager')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class ServerManagerController {
  constructor(
    private readonly serverManagerService: ServerManagerService,
    private readonly serverSettingsService: ServerSettingsService,
    private readonly logStorageService: LogStorageService,
    private readonly lokiLoggerService: LokiLoggerService,
    private readonly prometheusService: PrometheusService,
    private readonly systemAccessTokenService: SystemAccessTokenService,
  ) { }

  @Get('backups')
  @ApiOperation({ summary: 'List all database backups' })
  @ApiResponse({
    status: 200,
    description: 'List of backup files',
    type: [BackupInfoDto],
  })
  async listBackups(): Promise<BackupInfoDto[]> {
    return await this.serverManagerService.listBackups();
  }

  @Delete('backups/:filename')
  @ApiOperation({ summary: 'Delete a specific backup file' })
  @ApiResponse({
    status: 200,
    description: 'Backup deleted successfully',
    schema: { type: 'boolean' },
  })
  @ApiResponse({
    status: 404,
    description: 'Backup file not found',
  })
  async deleteBackup(@Param('filename') filename: string): Promise<boolean> {
    return await this.serverManagerService.deleteBackup(filename);
  }

  @Post('backups/trigger')
  @ApiOperation({ summary: 'Manually trigger a database backup' })
  @ApiResponse({
    status: 200,
    description: 'Backup triggered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        filename: { type: 'string' },
        size: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async triggerBackup(): Promise<{
    success: boolean;
    filename?: string;
    size?: string;
    message: string;
  }> {
    const result: BackupResult =
      await this.serverManagerService.triggerBackup();

    if (result.success) {
      return {
        success: true,
        filename: result.filename,
        size: result.size,
        message: `Backup created successfully: ${result.filename} (${result.size})`,
      };
    } else {
      return {
        success: false,
        message: `Backup failed: ${result.error}`,
      };
    }
  }

  // Server Settings endpoints
  @Get('settings')
  @ApiOperation({ summary: 'Get all server settings' })
  async getAllSettings(): Promise<ServerSetting[]> {
    return this.serverSettingsService.getAllSettings();
  }

  @Get('settings/:configType')
  @ApiOperation({ summary: 'Get a specific server setting by type' })
  async getSettingByType(
    @Param('configType') configType: ServerSettingType,
  ): Promise<ServerSetting | null> {
    return this.serverSettingsService.getSettingByType(configType);
  }

  @Patch('settings/:configType')
  @ApiOperation({ summary: 'Update an existing server setting' })
  async updateSetting(
    @Param('configType') configType: ServerSettingType,
    @Body() dto: UpdateServerSettingDto,
  ): Promise<ServerSetting> {
    return this.serverSettingsService.updateSetting(configType, dto);
  }

  @Post('settings/batch')
  @ApiOperation({ summary: 'Batch update multiple server settings' })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
    type: [ServerSetting],
  })
  async batchUpdateSettings(
    @Body() settings: Array<{ configType: ServerSettingType; valueText?: string | null; valueBool?: boolean | null; valueNumber?: number | null }>,
  ): Promise<ServerSetting[]> {
    return this.serverSettingsService.batchUpdateSettings(settings);
  }

  @Post('restart')
  @ApiOperation({ summary: 'Restart the server' })
  @ApiResponse({
    status: 200,
    description: 'Server restart initiated',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async restartServer(): Promise<{ success: boolean; message: string }> {
    return await this.serverManagerService.restartServer();
  }

  // Log Storage endpoints
  @Get('logs')
  @ApiOperation({ summary: 'Get logs with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'Paginated logs',
    type: PaginatedLogs,
  })
  async getLogs(@Query() input: GetLogsInput): Promise<PaginatedLogs> {
    return this.logStorageService.getLogs(input);
  }

  @Get('logs/count')
  @ApiOperation({ summary: 'Get total log count' })
  @ApiResponse({
    status: 200,
    description: 'Total log count',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' },
      },
    },
  })
  async getTotalLogCount(): Promise<{ count: number }> {
    const count = await this.logStorageService.getTotalLogCount();
    return { count };
  }

  @Post('logs/cleanup')
  @ApiOperation({ summary: 'Manually trigger log cleanup' })
  @ApiResponse({
    status: 200,
    description: 'Log cleanup triggered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async triggerLogCleanup(): Promise<{ success: boolean; message: string }> {
    try {
      await this.logStorageService.cleanupOldLogs();
      return {
        success: true,
        message: 'Log cleanup completed successfully. Check console for details.',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to cleanup logs: ${error.message}`,
      };
    }
  }

  // Prometheus endpoints
  /**
   * Metrics endpoint - protected by SystemAccessTokenGuard
   * Requires a System Access Token with format: Bearer sat_xxxxx
   * Authentication is always required
   */
  @Get('metrics')
  @UseGuards(SystemAccessTokenGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Get Prometheus metrics (requires System Access Token)' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics in text format',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid system access token',
  })
  async getMetrics(
    @Req() request: Request,
    @GetSystemAccessToken() sat: any,
  ): Promise<string> {
    // Check if Prometheus is enabled
    const prometheusEnabledSetting = await this.serverSettingsService.getSettingByType(
      ServerSettingType.PrometheusEnabled,
    );
    const isEnabled = prometheusEnabledSetting?.valueBool ?? false;

    if (!isEnabled) {
      throw new UnauthorizedException('Prometheus metrics are disabled');
    }

    // Increment system access token call count
    if (sat?.id) {
      await this.systemAccessTokenService.incrementCalls(sat.id);
    }

    // Return metrics
    return this.prometheusService.getMetrics();
  }
}
