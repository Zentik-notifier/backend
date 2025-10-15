import {
  Controller,
  Get,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ServerSettingType } from '../entities/server-setting.entity';
import { SystemAccessTokenGuard } from '../system-access-token/system-access-token.guard';
import { ServerSettingsService } from './server-settings.service';
import { LokiLoggerService } from './loki-logger.service';
import { LogLevel } from '../entities/log.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from 'src/auth/guards/admin-only.guard';

interface LokiStream {
  stream: Record<string, string>;
  values: [string, string][]; // [timestamp_ns, log_line]
}

interface LokiResponse {
  streams: LokiStream[];
}

@Controller('loki')
@ApiTags('Loki')
export class LokiController {
  constructor(
    private readonly serverSettingsService: ServerSettingsService,
    private readonly lokiLoggerService: LokiLoggerService,
  ) {}

  @Get('logs')
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get logs in Loki format for Promtail (requires System Access Token)',
    description:
      'Returns logs in Loki/Promtail compatible format. Requires authentication with a System Access Token (Bearer sat_xxxxx).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of logs to return (default: 100, max: 5000)',
  })
  @ApiQuery({
    name: 'level',
    required: false,
    enum: LogLevel,
    description: 'Filter logs by level',
  })
  @ApiQuery({
    name: 'context',
    required: false,
    type: String,
    description: 'Filter logs by context',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in log messages',
  })
  @ApiResponse({
    status: 200,
    description: 'Logs in Loki format',
    schema: {
      type: 'object',
      properties: {
        streams: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stream: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
              values: {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid system access token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Log storage is disabled',
  })
  async getLogs(
    @Query('limit') limit?: number,
    @Query('level') level?: LogLevel,
    @Query('context') context?: string,
    @Query('search') search?: string,
  ): Promise<LokiResponse> {
    // Check if Loki is enabled
    const lokiEnabledSetting =
      await this.serverSettingsService.getSettingByType(
        ServerSettingType.LokiEnabled,
      );
    const isEnabled = lokiEnabledSetting?.valueBool ?? false;

    if (!isEnabled) {
      throw new UnauthorizedException('Loki logging is disabled');
    }

    // Validate and set limit
    const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 5000);

    // Get logs from database in Loki format using the service
    const batch = await this.lokiLoggerService.getLogsFromDatabase({
      page: 1,
      limit: parsedLimit,
      level,
      context,
      search,
    });

    return batch;
  }
}
