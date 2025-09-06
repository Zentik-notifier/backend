import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
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
      if (!this.oauthProvidersService) {
        return {
          oauthProviders: [],
          emailEnabled: this.emailService.isEmailEnabled(),
        };
      }

      const providers =
        await this.oauthProvidersService.findEnabledProvidersPublic();
      const emailEnabled = this.emailService.isEmailEnabled();
      return {
        oauthProviders: providers,
        emailEnabled,
      };
    } catch (error) {
      // Fallback in caso di errore
      return {
        oauthProviders: [],
        emailEnabled: this.emailService.isEmailEnabled(),
      };
    }
  }
}
