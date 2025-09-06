import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OAuthProvidersService } from '../../oauth-providers/oauth-providers.service';

@Injectable()
export class OAuthProviderGuard implements CanActivate {
  private readonly logger = new Logger(OAuthProviderGuard.name);

  constructor(private readonly oauthProvidersService: OAuthProvidersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const provider: string = (request.params.provider || '').toLowerCase();

    // Log della richiesta per debug
    if (!provider) {
      this.logger.error('❌ No provider specified in OAuth request');
      this.logger.error(`   URL: ${request.url}`);
      this.logger.error(`   Method: ${request.method}`);
      throw new NotFoundException('No provider specified');
    }

    try {
      // Verifica che il provider esista e sia abilitato nel database
      const oauthProvider =
        await this.oauthProvidersService.findByProviderId(provider);

      if (!oauthProvider || !oauthProvider.isEnabled) {
        this.logger.error(
          `❌ Provider '${provider}' is not found or disabled in database`,
        );
        this.logger.error(`   URL: ${request.url}`);
        this.logger.error(`   Method: ${request.method}`);
        throw new NotFoundException(`Provider '${provider}' is not enabled`);
      }

      // Verifica che il provider abbia le credenziali necessarie
      if (!oauthProvider.clientId || !oauthProvider.clientSecret) {
        this.logger.error(`❌ Provider '${provider}' is missing credentials`);
        this.logger.error(`   URL: ${request.url}`);
        this.logger.error(`   Method: ${request.method}`);
        throw new NotFoundException(
          `Provider '${provider}' is not properly configured`,
        );
      }

      // this.logger.log(
      //   `✅ Provider '${provider}' is enabled and properly configured, proceeding with OAuth flow`,
      // );
    } catch (error) {
      this.logger.error(
        `❌ Failed to verify OAuth provider '${provider}' in database`,
        error,
      );
      throw new NotFoundException(
        `OAuth provider '${provider}' is not available`,
      );
    }

    const GuardClass: any = AuthGuard(provider);
    const guardInstance = new GuardClass();

    // Build state to round-trip mobile redirect (if provided)
    const existingState: string | undefined = request.query?.state as
      | string
      | undefined;
    const redirectUri: string | undefined = request.query?.redirect as
      | string
      | undefined;
    let stateToUse: string | undefined = existingState;

    if (!stateToUse && redirectUri) {
      try {
        const payload: any = { redirect: String(redirectUri) };
        const locale = request.query?.locale as string | undefined;
        if (locale) payload.locale = locale;
        stateToUse = Buffer.from(JSON.stringify(payload)).toString('base64url');
        // this.logger.log(`📱 Mobile redirect configured: ${redirectUri}`);
      } catch (error) {
        this.logger.warn(
          `⚠️  Failed to configure mobile redirect: ${error.message}`,
        );
        // ignore malformed redirect
      }
    }

    // Inject authenticate options dynamically
    guardInstance.getAuthenticateOptions = () => ({
      ...(stateToUse ? { state: stateToUse } : {}),
    });

    return guardInstance.canActivate(context);
  }
}
