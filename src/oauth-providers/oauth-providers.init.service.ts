import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { UrlBuilderService } from '../common/services/url-builder.service';
import { OAuthProviderType } from '../entities';
import { OAuthProvidersService } from './oauth-providers.service';

@Injectable()
export class OAuthProvidersInitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OAuthProvidersInitService.name);

  constructor(
    private readonly oauthProvidersService: OAuthProvidersService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly urlBuilderService: UrlBuilderService,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Initializing OAuth providers from database...');

    // Ensure the datasource is ready (TypeORM via Nest should already be initialized here)
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    try {
      await this.initializePredefinedProviders();
      await this.logProvidersStatus();
      this.logger.log('OAuth providers initialization completed successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OAuth providers', error);
    }
  }

  /**
   * Inizializza i provider predefiniti se non esistono nel database
   */
  private async initializePredefinedProviders(): Promise<void> {
    this.logger.log('Checking for predefined OAuth providers...');

    // GitHub
    const githubProvider =
      await this.oauthProvidersService.findByProviderId('github');
    if (!githubProvider) {
      this.logger.log('Creating GitHub OAuth provider...');

      const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'GITHUB_CLIENT_SECRET',
      );
      const callbackUrl =
        this.configService.get<string>('GITHUB_CALLBACK_URL') ||
        this.urlBuilderService.buildOAuthCallbackUrl('github');

      await this.oauthProvidersService.create({
        name: 'GitHub',
        providerId: 'github',
        type: OAuthProviderType.GITHUB,
        clientId: clientId || '',
        clientSecret: clientSecret || '',
        callbackUrl,
        scopes: ['user:email', 'read:user'],
        isEnabled: !!clientId && !!clientSecret,
        iconUrl:
          'https://toppng.com/uploads/preview/github-mark-logo-vector-11573976116njeqgb4ei1.png',
        color: '#24292e',
      });
      this.logger.log(
        `GitHub OAuth provider created with callback: ${callbackUrl}`,
      );
    }

    // Google
    const googleProvider =
      await this.oauthProvidersService.findByProviderId('google');
    if (!googleProvider) {
      this.logger.log('Creating Google OAuth provider...');

      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'GOOGLE_CLIENT_SECRET',
      );
      const callbackUrl =
        this.configService.get<string>('GOOGLE_CALLBACK_URL') ||
        this.urlBuilderService.buildOAuthCallbackUrl('google');

      await this.oauthProvidersService.create({
        name: 'Google',
        providerId: 'google',
        type: OAuthProviderType.GOOGLE,
        clientId: clientId || '',
        clientSecret: clientSecret || '',
        callbackUrl,
        scopes: ['openid', 'email', 'profile'],
        isEnabled: !!clientId && !!clientSecret,
        iconUrl:
          'https://toppng.com/uploads/preview/google-g-logo-icon-11609362962anodywxeaz.png',
        color: '#4285f4',
      });
      this.logger.log(
        `Google OAuth provider created with callback: ${callbackUrl}`,
      );
    }

    this.logger.log('Predefined OAuth providers check completed');
  }

  // Note: updateExistingProvidersFromEnv method removed - no more fallback to environment variables

  /**
   * Metodo pubblico per reinizializzare i provider (utile per testing o reset)
   */
  async reinitializeProviders(): Promise<void> {
    this.logger.log('Reinitializing OAuth providers...');

    try {
      // Rimuovi tutti i provider esistenti
      const existingProviders = await this.oauthProvidersService.findAll();
      for (const provider of existingProviders) {
        await this.oauthProvidersService.remove(provider.id);
      }

      // Ricrea i provider predefiniti
      await this.initializePredefinedProviders();

      this.logger.log('OAuth providers reinitialized successfully');
    } catch (error) {
      this.logger.error('Failed to reinitialize OAuth providers', error);
      throw error;
    }
  }

  async logProvidersStatus(): Promise<void> {
    const providers = await this.oauthProvidersService.findAll();

    this.logger.log(`Found ${providers.length} OAuth providers in database:`);

    for (const provider of providers) {
      const status = provider.isEnabled ? '✅ ENABLED' : '❌ DISABLED';
      const hasCredentials =
        provider.clientId && provider.clientSecret ? '🔑' : '⚠️ NO CREDENTIALS';

      this.logger.log(
        `  ${status} ${hasCredentials} ${provider.name} (${provider.providerId})`,
      );

      if (!provider.clientId || !provider.clientSecret) {
        this.logger.warn(
          `    Missing credentials for ${provider.name}. Set ${provider.providerId.toUpperCase()}_CLIENT_ID and ${provider.providerId.toUpperCase()}_CLIENT_SECRET environment variables.`,
        );
      }
    }
  }
}
