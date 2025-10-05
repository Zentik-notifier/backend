import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AttachmentsService } from './attachments/attachments.service';
import { EmailService } from './auth/email.service';
import { JwtOrAccessTokenGuard } from './auth/guards/jwt-or-access-token.guard';
import { OAuthProvidersService } from './oauth-providers/oauth-providers.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly oauthProvidersService: OAuthProvidersService,
    private readonly emailService: EmailService,
    private readonly attachmentsService: AttachmentsService,
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
      const emailEnabled = this.emailService.isEmailEnabled();
      const uploadEnabled = this.attachmentsService.isAttachmentsEnabled();

      return {
        oauthProviders: providers,
        emailEnabled,
        uploadEnabled,
      };
    } catch (error) {
      throw error;
    }
  }
}
