import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServerSetting, ServerSettingType } from '../entities/server-setting.entity';
import { BackupInfoDto, UpdateServerSettingDto } from './dto';
import { BackupResult, ServerManagerService } from './server-manager.service';
import { ServerSettingsService } from './server-settings.service';

@ApiTags('Server Manager')
@Controller('server-manager')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class ServerManagerController {
  constructor(
    private readonly serverManagerService: ServerManagerService,
    private readonly serverSettingsService: ServerSettingsService,
  ) {}

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
}
