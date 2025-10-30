import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OAuthProvider, OAuthProviderType } from '../entities/oauth-provider.entity';

export async function ensureOAuthProviders(dataSource: DataSource) {
  const logger = new Logger('OAuthProvidersSeed');

  const oauthProvidersRepo = dataSource.getRepository(OAuthProvider);

  // Get public backend URL from environment
  const publicUrl = process.env.PUBLIC_BACKEND_URL || 'http://localhost:3000';

  // Default providers configuration
  const defaultProviders = [
    {
      name: 'GitHub',
      providerId: 'github',
      type: OAuthProviderType.GITHUB,
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl: `${publicUrl}/api/v1/auth/github/callback`,
      scopes: ['user:email', 'read:user'],
      iconUrl: 'https://cdn-icons-png.flaticon.com/128/1051/1051326.png',
      color: '#FFFFFF',
      textColor: '#000000',
    },
    {
      name: 'Google',
      providerId: 'google',
      type: OAuthProviderType.GOOGLE,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: `${publicUrl}/api/v1/auth/google/callback`,
      scopes: ['openid', 'email', 'profile'],
      iconUrl: 'https://www.gstatic.com/marketing-cms/assets/images/d5/dc/cfe9ce8b4425b410b49b7f2dd3f3/g.webp=s96-fcrop64=1,00000000ffffffff-rw',
      color: '#FFFFFF',
      textColor: '#000000',
    },
    {
      name: 'Discord',
      providerId: 'discord',
      type: OAuthProviderType.DISCORD,
      clientId: undefined,
      clientSecret: undefined,
      callbackUrl: `${publicUrl}/api/v1/auth/discord/callback`,
      scopes: ['identify', 'email'],
      iconUrl: 'https://cdn-icons-png.flaticon.com/128/5968/5968756.png',
      color: '#FFFFFF',
      textColor: '#5865F2',
      authorizationUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      userInfoUrl: 'https://discord.com/api/users/@me',
      profileFields: ['id', 'username', 'email', 'avatar', 'discriminator'],
    },
    {
      name: 'Apple',
      providerId: 'apple',
      type: OAuthProviderType.APPLE,
      clientId: undefined,
      clientSecret: undefined,
      callbackUrl: `${publicUrl}/api/v1/auth/apple/callback`,
      scopes: ['name', 'email'],
      iconUrl: 'https://cdn-icons-png.flaticon.com/128/15/15476.png',
      color: '#FFFFFF',
      textColor: '#000000',
      authorizationUrl: 'https://appleid.apple.com/auth/authorize',
      tokenUrl: 'https://appleid.apple.com/auth/token',
      userInfoUrl: 'https://appleid.apple.com/auth/userinfo',
      profileFields: ['sub', 'email', 'name'],
    },
  ];

  logger.log(`Processing ${defaultProviders.length} OAuth provider(s)...`);

  for (const providerData of defaultProviders) {
    try {
      // Check if provider already exists
      const existingProvider = await oauthProvidersRepo.findOne({
        where: { providerId: providerData.providerId },
      });

      if (existingProvider) {
        let updated = false;

        if (!existingProvider.color || existingProvider.color !== providerData.color) {
          existingProvider.color = providerData.color;
          updated = true;
        }

        if (!existingProvider.textColor || existingProvider.textColor !== providerData.textColor) {
          existingProvider.textColor = providerData.textColor;
          updated = true;
        }

        if (!existingProvider.iconUrl || existingProvider.iconUrl !== providerData.iconUrl) {
          existingProvider.iconUrl = providerData.iconUrl;
          updated = true;
        }

        if (!existingProvider.callbackUrl || existingProvider.callbackUrl !== providerData.callbackUrl) {
          existingProvider.callbackUrl = providerData.callbackUrl;
          updated = true;
        }

        if (existingProvider.scopes.join(',') !== providerData.scopes.join(',')) {
          existingProvider.scopes = providerData.scopes;
          updated = true;
        }

        if (updated) {
          await oauthProvidersRepo.save(existingProvider);
          logger.log(
            `Updated existing provider: ${providerData.name}`,
          );
        } else {
          logger.log(`Provider already up to date: ${providerData.name}`);
        }
      } else {
        // Create new provider even without credentials
        // If no credentials or placeholder, set isEnabled to false
        const hasCredentials =
          providerData.clientId &&
          providerData.clientSecret &&
          providerData.clientId !== 'PLACEHOLDER_NEEDS_CONFIGURATION' &&
          providerData.clientSecret !== 'PLACEHOLDER_NEEDS_CONFIGURATION';

        const providerToCreate = {
          ...providerData,
          isEnabled: !!hasCredentials,
        } as any;

        const newProvider = oauthProvidersRepo.create(providerToCreate);
        await oauthProvidersRepo.save(newProvider);

        if (hasCredentials) {
          logger.log(`Created new OAuth provider: ${providerData.name}`);
        } else {
          logger.log(
            `Created new OAuth provider (disabled): ${providerData.name} - credentials not configured`,
          );
        }
      }
    } catch (error) {
      logger.error(
        `Failed to process OAuth provider ${providerData.name}:`,
        error.message,
      );
    }
  }

  logger.log('🎯 OAuth providers processing completed');
}

