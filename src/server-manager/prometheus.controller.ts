import { Controller, Get, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Response } from 'express';
import { RequireSystemScopes } from 'src/system-access-token/decorators/require-system-scopes.decorator';
import { SystemAccessScopesGuard } from 'src/system-access-token/system-access-scopes.guard';
import { SystemAccessTokenGuard } from 'src/system-access-token/system-access-token.guard';
import { ServerSettingType } from '../entities/server-setting.entity';
import { ServerSettingsService } from './server-settings.service';

@Controller('metrics')
@ApiTags('Metrics')
export class CustomPrometheusController extends PrometheusController {
  constructor(
    private readonly serverSettingsService: ServerSettingsService,
  ) {
    super();
  }

  @Get()
  @UseGuards(SystemAccessTokenGuard, SystemAccessScopesGuard)
  @RequireSystemScopes(['prometheus'])
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Prometheus metrics (requires System Access Token with prometheus scope)',
    description: 'Returns all Prometheus metrics in text format. Requires authentication with a System Access Token (Bearer sat_xxxxx) that has the "prometheus" scope.'
  })
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
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Prometheus metrics are disabled',
  })
  async index(
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    // Get system access token from request (injected by guard)
    const sat = (response.req as any).systemAccessToken;

    // Check if Prometheus is enabled
    const prometheusEnabledSetting = await this.serverSettingsService.getSettingByType(
      ServerSettingType.PrometheusEnabled,
    );
    const isEnabled = prometheusEnabledSetting?.valueBool ?? false;

    if (!isEnabled) {
      throw new UnauthorizedException('Prometheus metrics are disabled');
    }

    // Call parent method to return metrics
    return super.index(response);
  }
}
