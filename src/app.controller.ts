import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AttachmentsService } from './attachments/attachments.service';
import { EmailService } from './auth/email.service';
import { JwtOrAccessTokenGuard } from './auth/guards/jwt-or-access-token.guard';
import { OAuthProvidersService } from './oauth-providers/oauth-providers.service';
import { ServerSettingsService } from './server-manager/server-settings.service';
import { ServerSettingType } from './entities/server-setting.entity';
import {
  getAllIconMappings,
  listAllIcons,
  ZentikIcon,
} from './common/icon-mapping.util';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly oauthProvidersService: OAuthProvidersService,
    private readonly emailService: EmailService,
    private readonly attachmentsService: AttachmentsService,
    private readonly serverSettingsService: ServerSettingsService,
  ) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: this.appService.getVersion(),
    };
  }

  @Get('version')
  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  getVersion() {
    return {
      version: this.appService.getVersion(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('public/app-config')
  async getPublicAppConfig() {
    try {
      const providers =
        await this.oauthProvidersService.findEnabledProvidersPublic();
      const emailEnabled = await this.emailService.isEmailEnabled();
      const uploadEnabled = await this.attachmentsService.isAttachmentsEnabled();
      const systemTokenRequestsEnabled = await this.serverSettingsService.getBooleanValue(
        ServerSettingType.EnableSystemTokenRequests,
        true, // Default to enabled for backward compatibility
      );

      return {
        oauthProviders: providers,
        emailEnabled,
        uploadEnabled,
        systemTokenRequestsEnabled,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('public/icon-mappings')
  getIconMappings() {
    const mappings = getAllIconMappings();
    const icons = listAllIcons();

    return {
      icons: icons,
      mappings: mappings,
      count: icons.length,
      description:
        'Zentik cross-platform icon mappings (iOS SF Symbols, Web Material Icons, Android Emoji)',
      example: {
        icon: ZentikIcon.BELL,
        platforms: mappings[ZentikIcon.BELL],
      },
    };
  }
}
