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
  ) { }

  // In-memory cache for public endpoints
  private publicAppConfigCache: { data: any; fetchedAt: number } | null = null;
  private static readonly PUBLIC_CACHE_TTL_MS = 30_000;

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
      // Serve from cache if fresh
      if (
        this.publicAppConfigCache &&
        Date.now() - this.publicAppConfigCache.fetchedAt < AppController.PUBLIC_CACHE_TTL_MS
      ) {
        return this.publicAppConfigCache.data;
      }
      const providers =
        await this.oauthProvidersService.findEnabledProvidersPublic();
      const emailEnabled = await this.emailService.isEmailEnabled();
      const uploadEnabled = await this.attachmentsService.isAttachmentsEnabled();
      const iconUploaderEnabled = await this.serverSettingsService.getBooleanValue(
        ServerSettingType.IconUploaderEnabled,
        true,
      );
      const systemTokenRequestsEnabled = await this.serverSettingsService.getBooleanValue(
        ServerSettingType.EnableSystemTokenRequests,
      );
      const localRegistrationEnabled = await this.serverSettingsService.getBooleanValue(
        ServerSettingType.LocalRegistrationEnabled,
        false,
      );
      const socialRegistrationEnabled = await this.serverSettingsService.getBooleanValue(
        ServerSettingType.SocialRegistrationEnabled,
        false,
      );
      const socialLoginEnabled = await this.serverSettingsService.getBooleanValue(
        ServerSettingType.SocialLoginEnabled,
        true,
      );
      const externalNotifySystemsEnabled = await this.serverSettingsService.getBooleanValue(
        ServerSettingType.ExternalNotifySystemsEnabled,
        true,
      );

      const response = {
        oauthProviders: providers,
        emailEnabled,
        uploadEnabled,
        iconUploaderEnabled,
        systemTokenRequestsEnabled,
        localRegistrationEnabled,
        socialRegistrationEnabled,
        socialLoginEnabled,
        externalNotifySystemsEnabled,
      };

      this.publicAppConfigCache = { data: response, fetchedAt: Date.now() };
      return response;
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
