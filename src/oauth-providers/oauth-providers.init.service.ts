import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OAuthProvidersService } from './oauth-providers.service';

@Injectable()
export class OAuthProvidersInitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OAuthProvidersInitService.name);

  constructor(
    private readonly oauthProvidersService: OAuthProvidersService,
    private readonly dataSource: DataSource,
  ) { }

  async onApplicationBootstrap() {
    this.logger.log('Initializing OAuth providers from database...');

    // Ensure the datasource is ready (TypeORM via Nest should already be initialized here)
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    try {
      await this.logProvidersStatus();
      this.logger.log('OAuth providers initialization completed successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OAuth providers', error);
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
