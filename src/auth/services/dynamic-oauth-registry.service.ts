import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as AppleStrategy } from '@nicokaiser/passport-apple';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
// import { Strategy as AmazonStrategy } from 'passport-amazon';
// import { Strategy as LinkedinStrategy } from 'passport-linkedin-oauth2';
// import { Strategy as RedditStrategy } from 'passport-reddit';
import { UrlBuilderService } from '../../common/services/url-builder.service';
import { OAuthProvider, OAuthProviderType } from '../../entities';
import { OAuthProvidersService } from '../../oauth-providers/oauth-providers.service';
import { AuthService } from '../auth.service';
import * as fs from 'fs';

interface ProviderStrategyConfig {
  name: string;
  strategy: any;
  config: any;
}

@Injectable()
export class DynamicOAuthRegistryService implements OnModuleInit {
  private readonly logger = new Logger(DynamicOAuthRegistryService.name);
  // Keyed by enum value (uppercase), strategy registered in Passport with lowercase name
  private registeredProviders = new Map<string, ProviderStrategyConfig>();
  private isInitialized = false;

  constructor(
    private readonly oauthProvidersService: OAuthProvidersService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly urlBuilderService: UrlBuilderService,
  ) { }

  async onModuleInit() {
    this.logger.log('🔄 Initializing Dynamic OAuth Registry...');

    // Connect with OAuth providers service for notifications
    this.oauthProvidersService.setRegistryService(this);

    // Initialize providers in background to not block startup
    this.initializeProvidersAsync();
  }

  private async initializeProvidersAsync() {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries && !this.isInitialized) {
      try {
        // Wait for database and OAuth providers initialization to be ready
        // OAuthProvidersInitService waits 1.5s, so we wait longer
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 + 1000 * retryCount),
        );

        // Register all enabled providers from database
        await this.registerAllEnabledProviders();

        this.isInitialized = true;
        this.logger.log('✅ Dynamic OAuth Registry initialized successfully');
        break;
      } catch (error) {
        retryCount++;
        this.logger.warn(
          `⚠️ Failed to initialize OAuth registry (attempt ${retryCount}/${maxRetries}):`,
          error.message,
        );

        if (retryCount === maxRetries) {
          this.logger.error(
            '❌ Failed to initialize OAuth registry after all retries. Will continue without OAuth providers.',
          );
        }
      }
    }
  }

  private async registerAllEnabledProviders() {
    try {
      const enabledProviders =
        await this.oauthProvidersService.findEnabledProviders();

      this.logger.log(
        `📋 Found ${enabledProviders.length} enabled OAuth providers`,
      );

      for (const provider of enabledProviders) {
        await this.registerProvider(provider);
      }

      this.logger.log('✅ All enabled OAuth providers registered successfully');
    } catch (error) {
      this.logger.error('❌ Failed to register OAuth providers:', error);
    }
  }

  async registerProvider(provider: OAuthProvider): Promise<void> {
    try {
      const enumKey = provider.type; // e.g. 'GOOGLE'
      const idKey = provider.type.toLowerCase(); // e.g. 'google' for endpoints/strategy name
      this.logger.log(
        `🔗 Registering OAuth provider: ${provider.name} (${enumKey})`,
      );

      // If provider is already registered, update it
      if (this.registeredProviders.has(enumKey)) {
        await this.updateProvider(provider);
        return;
      }

      const strategy = this.createStrategy(provider);

      if (!strategy) {
        this.logger.warn(
          `⚠️ Could not create strategy for provider: ${idKey}`,
        );
        return;
      }

      // Register strategy with Passport
      passport.use(idKey, strategy);

      // Store provider configuration
      this.registeredProviders.set(enumKey, {
        name: enumKey,
        strategy,
        config: this.getProviderConfig(provider),
      });

      this.logger.log(
        `✅ OAuth provider registered: ${provider.name} (${enumKey})`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to register OAuth provider: ${provider?.type?.toString?.()}`,
        error,
      );
    }
  }

  async updateProvider(provider: OAuthProvider): Promise<void> {
    try {
      const enumKey = provider.type;
      const idKey = provider.type.toLowerCase();
      this.logger.log(
        `🔄 Updating OAuth provider: ${provider.name} (${enumKey})`,
      );

      // Check if provider is currently enabled before deregistering
      const isCurrentlyEnabled =
        await this.oauthProvidersService.isProviderEnabled(provider.type.toLowerCase());

      if (!isCurrentlyEnabled) {
        this.logger.log(
          `⚠️ Provider ${enumKey} is not currently enabled, deregistering...`,
        );
        // Unregister existing provider if it's not enabled
        await this.unregisterProvider(enumKey);
        return;
      }

      // Provider is enabled, check if configuration has actually changed
      const currentConfig = this.registeredProviders.get(enumKey);
      if (currentConfig) {
        const newConfig = this.getProviderConfig(provider);
        const hasConfigChanged = this.hasConfigurationChanged(
          currentConfig.config,
          newConfig,
        );

        if (!hasConfigChanged) {
          this.logger.log(
            `ℹ️ Provider ${idKey} configuration unchanged, skipping update`,
          );
          return;
        }
      }

      // Configuration has changed or provider not registered, proceed with update
      this.logger.log(
        `🔄 Configuration changed for provider ${enumKey}, updating...`,
      );

      // Unregister existing provider first
      await this.unregisterProvider(enumKey);

      // Register with new configuration
      await this.registerProvider(provider);

      this.logger.log(
        `✅ OAuth provider updated: ${provider.name} (${enumKey})`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to update OAuth provider: ${provider?.type?.toString?.()}`,
        error,
      );
    }
  }

  async unregisterProvider(providerId: string): Promise<void> {
    try {
      const enumKey = providerId.toUpperCase();
      const strategyName = enumKey.toLowerCase();
      this.logger.log(`🗑️ Unregistering OAuth provider: ${enumKey}`);

      if (!this.registeredProviders.has(enumKey)) {
        this.logger.warn(`⚠️ Provider not registered: ${enumKey}`);
        return;
      }

      // Remove from Passport
      passport.unuse(strategyName);

      // Remove from our registry
      this.registeredProviders.delete(enumKey);

      this.logger.log(`✅ OAuth provider unregistered: ${enumKey}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to unregister OAuth provider: ${providerId}`,
        error,
      );
    }
  }

  private createStrategy(provider: OAuthProvider): any {
    switch (provider.type) {
      case OAuthProviderType.GITHUB:
        return new GitHubStrategy(
          {
            clientID: provider.clientId,
            clientSecret: provider.clientSecret,
            callbackURL: this.getCallbackUrl(provider),
            scope: provider.scopes,
            passReqToCallback: true, // Enable req parameter in validate function
          },
          this.createValidateFunction(provider),
        );

      case OAuthProviderType.GOOGLE:
        return new GoogleStrategy(
          {
            clientID: provider.clientId,
            clientSecret: provider.clientSecret,
            callbackURL: this.getCallbackUrl(provider),
            scope: provider.scopes,
            passReqToCallback: true, // Enable req parameter in validate function
          },
          this.createValidateFunction(provider),
        );

      case OAuthProviderType.DISCORD:
        return new DiscordStrategy(
          {
            clientID: provider.clientId,
            clientSecret: provider.clientSecret,
            callbackURL: this.getCallbackUrl(provider),
            scope: provider.scopes,
            passReqToCallback: true,
          },
          this.createValidateFunction(provider),
        );

      case OAuthProviderType.APPLE: {
        const { teamId, privateKeyPath, keyIdentifier } = JSON.parse(provider.additionalConfig || '{}');
        if (!privateKeyPath) {
          throw new Error('Apple privateKeyPath is not configured');
        }
        if (!fs.existsSync(privateKeyPath)) {
          throw new Error(`Apple privateKeyPath not found: ${privateKeyPath}`);
        }
        const key = fs.readFileSync(privateKeyPath, 'utf8');
        return new AppleStrategy(
          {
            clientID: provider.clientId,
            teamID: teamId,
            keyID: keyIdentifier,
            key,
            callbackURL: this.getCallbackUrl(provider),
            passReqToCallback: true,
            scope: provider.scopes || ['name', 'email'],
          } as any,
          // Signature for AppleStrategy with passReqToCallback: (req, accessToken, refreshToken, idToken, profile, done)
          (req: any, accessToken: string, refreshToken: string, idToken: string, profile: any, done: any) => {
            // Delegate to common validate, ignoring idToken
            const validate = this.createValidateFunction(provider);
            return (validate as any)(req, accessToken, refreshToken, profile, done);
          },
        );
      }

      case OAuthProviderType.FACEBOOK:
        return new FacebookStrategy(
          {
            clientID: provider.clientId,
            clientSecret: provider.clientSecret,
            callbackURL: this.getCallbackUrl(provider),
            scope: provider.scopes,
            profileFields: provider.profileFields,
            passReqToCallback: true,
          },
          this.createValidateFunction(provider),
        );

      case OAuthProviderType.MICROSOFT:
        return new MicrosoftStrategy(
          {
            authorizationURL: provider.authorizationUrl,
            clientID: provider.clientId,
            clientSecret: provider.clientSecret,
            callbackURL: this.getCallbackUrl(provider),
            scope: provider.scopes,
            passReqToCallback: true,
          },
          this.createValidateFunction(provider),
        );

      case OAuthProviderType.CUSTOM:
        return new OAuth2Strategy(
          {
            authorizationURL: provider.authorizationUrl!,
            tokenURL: provider.tokenUrl!,
            clientID: provider.clientId,
            clientSecret: provider.clientSecret,
            callbackURL: this.getCallbackUrl(provider),
            scope: provider.scopes,
            passReqToCallback: true, // Enable req parameter in validate function
          },
          this.createValidateFunction(provider),
        );

      default:
        this.logger.error(`Unsupported provider type: ${provider.type}`);
        return null;
    }
  }

  private createValidateFunction(provider: OAuthProvider) {
    return async (
      req: any,
      accessToken: string,
      refreshToken: string,
      profile: any,
      done: any,
    ) => {
      try {
        // this.logger.log(
        //   `🔐 OAuth validation for provider: ${provider.providerId}`,
        // );
        // this.logger.debug(
        //   `🔍 Raw profile received: ${JSON.stringify(profile)}`,
        // );

        // For custom providers, we might need to fetch user info manually
        if (
          provider.type === OAuthProviderType.CUSTOM &&
          (!profile || Object.keys(profile).length === 0 || !profile.id)
        ) {
          this.logger.log(
            `🔍 Empty profile for custom provider, fetching user info from: ${provider.userInfoUrl}`,
          );

          if (provider.userInfoUrl) {
            try {
              const response = await fetch(provider.userInfoUrl, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: 'application/json',
                  'User-Agent': 'Zentik-OAuth-Client/1.0',
                },
              });

              if (response.ok) {
                const userInfo = await response.json();
                this.logger.log(`✅ User info fetched successfully`);
                this.logger.debug(
                  `🔍 Fetched user info: ${JSON.stringify(userInfo)}`,
                );

                // Replace the empty profile with fetched user info
                profile = userInfo;
              } else {
                this.logger.error(
                  `❌ Failed to fetch user info: ${response.status} ${response.statusText}`,
                );
                const errorText = await response.text();
                this.logger.debug(`🔍 Error response: ${errorText}`);
                return done(
                  new Error(
                    `Failed to fetch user info: ${response.statusText}`,
                  ),
                  false,
                );
              }
            } catch (fetchError) {
              this.logger.error(`❌ Error fetching user info:`, fetchError);
              return done(
                new Error(`Error fetching user info: ${fetchError.message}`),
                false,
              );
            }
          } else {
            this.logger.error(
              `❌ No userInfoUrl configured for custom provider: ${provider.type}`,
            );
            return done(
              new Error('No userInfoUrl configured for custom provider'),
              false,
            );
          }
        }

        // Check if this is a connection flow by extracting user info from state
        let connectToUserId: string | undefined;
        let localeFromState: string | undefined;
        if (req?.query?.state) {
          try {
            // this.logger.debug(`🔍 Raw state parameter: ${req.query.state}`);

            // Try to decode the state - it might be base64url or regular base64
            let stateString: string;
            try {
              // First try base64url decoding
              stateString = Buffer.from(req.query.state, 'base64url').toString(
                'utf8',
              );
            } catch (e) {
              // If that fails, try regular base64 (convert base64url back to base64)
              const regularBase64 = req.query.state
                .replace(/-/g, '+')
                .replace(/_/g, '/');
              // Add padding if needed
              const padding = 4 - (regularBase64.length % 4);
              const paddedBase64 = regularBase64 + '='.repeat(padding % 4);
              stateString = Buffer.from(paddedBase64, 'base64').toString(
                'utf8',
              );
            }

            const decoded = JSON.parse(stateString);
            // this.logger.debug(`🔍 Decoded state: ${JSON.stringify(decoded)}`);
            if (decoded?.locale) {
              localeFromState = String(decoded.locale);
              // this.logger.debug(`🌐 OAuth locale from state: '${localeFromState}'`);
            }

            // Check if this is a connection flow
            if (decoded?.connectToUserId && decoded?.accessToken) {
              this.logger.log(
                `🔗 OAuth connection flow detected with access token`,
              );
              this.logger.debug(
                `🔍 Access token from state: ${decoded.accessToken.substring(0, 50)}...`,
              );

              // Validate the access token to get user ID
              try {
                const jwtSecret = this.configService.get<string>('JWT_SECRET');
                const payload = this.jwtService.verify(decoded.accessToken, {
                  secret: jwtSecret,
                });
                connectToUserId = payload.sub;
                this.logger.log(
                  `✅ Connection flow validated for user: ${connectToUserId}`,
                );
              } catch (tokenError) {
                this.logger.warn(
                  `❌ Invalid access token in connection flow: ${tokenError.message}`,
                );
                this.logger.debug(
                  `🔍 Token validation failed for token: ${decoded.accessToken.substring(0, 100)}...`,
                );
                return done(
                  new Error('Invalid access token for connection flow'),
                  false,
                );
              }
            }
          } catch (e) {
            this.logger.warn(`⚠️ Failed to parse state: ${e.message}`);
          }
        }

        // Normalize profile based on provider type
        const normalizedProfile = this.normalizeProfile(profile, provider);
        // this.logger.debug(
        //   `🔍 Normalized profile: ${JSON.stringify(normalizedProfile)}`,
        // );

        // Create or update user using the auth service
        const user = await this.authService.findOrCreateUserFromProvider(
          provider.type,
          {
            email: normalizedProfile.email,
            name: normalizedProfile.displayName,
            providerId: normalizedProfile.id,
            avatarUrl: normalizedProfile.avatar,
            username: normalizedProfile.username,
            firstName: normalizedProfile.firstName,
            lastName: normalizedProfile.lastName,
            locale: localeFromState,
          },
          connectToUserId, // Pass the current user ID if this is a connection flow
        );

        this.logger.log(
          `✅ OAuth authentication successful for user: ${user.email} via ${provider.type}`,
        );
        return done(null, user);
      } catch (error) {
        this.logger.error(
          `❌ OAuth validation failed for provider: ${provider.type}`,
          error,
        );
        // If social registration is disabled, avoid throwing to let UI handle gracefully
        const isSocialDisabled =
          (error?.message && String(error.message).includes('Social registration is disabled')) ||
          (error?.response?.message && String(error.response.message).includes('Social registration is disabled'));

        if (isSocialDisabled) {
          this.logger.warn(`🚫 OAuth validation blocked (social registration disabled) for provider: ${provider.type}`);
          // Attach a soft error to user payload so downstream can redirect with a sanitized error
          return done(null, { oauthError: 'oauth_failed' } as any);
        }

        return done(error, false);
      }
    };
  }

  private normalizeProfile(
    profile: any,
    provider: OAuthProvider,
  ): {
    id: string;
    email?: string;
    displayName?: string;
    username?: string;
    avatar?: string;
    firstName?: string;
    lastName?: string;
  } {
    switch (provider.type) {
      case OAuthProviderType.GITHUB:
        return {
          id:
            profile.id?.toString() ||
            profile._json?.id?.toString() ||
            'unknown',
          email: profile.emails?.[0]?.value || profile._json?.email,
          displayName: profile.displayName || profile.username,
          username: profile.username,
          avatar: profile.photos?.[0]?.value || profile._json?.avatar_url,
          firstName:
            profile._json?.name?.split(' ')?.[0] ||
            profile.displayName?.split(' ')?.[0],
          lastName:
            profile._json?.name?.split(' ')?.slice(1)?.join(' ') ||
            profile.displayName?.split(' ')?.slice(1)?.join(' '),
        };

      case OAuthProviderType.GOOGLE:
        return {
          id: profile.id?.toString() || profile._json?.sub || 'unknown',
          email: profile.emails?.[0]?.value,
          displayName: profile.displayName,
          username: this.extractGoogleUsername(profile),
          avatar: profile.photos?.[0]?.value,
          firstName: profile.name?.givenName || profile._json?.given_name,
          lastName: profile.name?.familyName || profile._json?.family_name,
        };

      case OAuthProviderType.DISCORD:
        return {
          id: profile.id?.toString() || 'unknown',
          email: profile.email,
          displayName: profile.username || profile.global_name,
          username: profile.username,
          avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : undefined,
          firstName: profile.global_name?.split(' ')?.[0],
          lastName: profile.global_name?.split(' ')?.slice(1)?.join(' '),
        };

      case OAuthProviderType.FACEBOOK:
        return {
          id: profile.id?.toString() || 'unknown',
          email: profile.emails?.[0]?.value || profile._json?.email,
          displayName: profile.displayName || profile._json?.name,
          username: profile.username || profile._json?.name?.toLowerCase().replace(/\s/g, ''),
          avatar: profile.photos?.[0]?.value || profile._json?.picture?.data?.url,
          firstName: profile.name?.givenName || profile._json?.first_name || profile._json?.name?.split(' ')?.[0],
          lastName: profile.name?.familyName || profile._json?.last_name || profile._json?.name?.split(' ')?.slice(1)?.join(' '),
        };

      case OAuthProviderType.MICROSOFT:
        return {
          id: profile.id?.toString() || profile._json?.sub || 'unknown',
          email: profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName,
          displayName: profile.displayName || profile._json?.displayName,
          username: profile._json?.userPrincipalName?.split('@')?.[0] || profile._json?.mail?.split('@')?.[0],
          avatar: profile.photos?.[0]?.value,
          firstName: profile.name?.givenName || profile._json?.givenName,
          lastName: profile.name?.familyName || profile._json?.surname,
        };

      case OAuthProviderType.CUSTOM:
        // Use profileFields mapping if available
        const fields = provider.profileFields || [];
        return {
          id:
            this.extractField(profile, ['id', 'sub', 'user_id'], fields) ||
            'unknown',
          email: this.extractField(profile, ['email'], fields),
          displayName: this.extractField(
            profile,
            ['name', 'display_name', 'full_name'],
            fields,
          ),
          username: this.extractField(
            profile,
            ['username', 'preferred_username'],
            fields,
          ),
          avatar: this.extractField(
            profile,
            ['picture', 'avatar', 'avatar_url'],
            fields,
          ),
          firstName: this.extractField(
            profile,
            ['given_name', 'first_name'],
            fields,
          ),
          lastName: this.extractField(
            profile,
            ['family_name', 'last_name'],
            fields,
          ),
        };

      default:
        return {
          id: profile.id?.toString() || 'unknown',
          email: profile.email,
          displayName: profile.name || profile.displayName,
          username: profile.username,
          avatar: profile.picture || profile.avatar,
          firstName: profile.given_name || profile.firstName,
          lastName: profile.family_name || profile.lastName,
        };
    }
  }

  private extractGoogleUsername(profile: any): string {
    // Try to extract username from Google profile in order of preference:
    // 1. Use given_name + family_name (first name + last name)
    // 2. Use displayName without spaces
    // 3. Use email prefix (part before @)
    // 4. Fallback to email

    const givenName = profile.name?.givenName || profile._json?.given_name;
    const familyName = profile.name?.familyName || profile._json?.family_name;

    // Option 1: Combine first and last name
    if (givenName && familyName) {
      return `${givenName}${familyName}`
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }

    // Option 2: Use displayName without spaces and special chars
    if (profile.displayName) {
      const cleanDisplayName = profile.displayName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      if (cleanDisplayName.length > 0) {
        return cleanDisplayName;
      }
    }

    // Option 3: Use email prefix
    const email = profile.emails?.[0]?.value;
    if (email) {
      const emailPrefix = email.split('@')[0];
      if (emailPrefix.length > 0) {
        return emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    }

    // Fallback: use email or id
    return email || profile.id?.toString() || 'googleuser';
  }

  private extractField(
    profile: any,
    defaultFields: string[],
    mappedFields: string[],
  ): string | undefined {
    // First try mapped fields
    for (const field of mappedFields) {
      if (profile[field]) {
        return profile[field];
      }
    }

    // Fallback to default fields
    for (const field of defaultFields) {
      if (profile[field]) {
        return profile[field];
      }
    }

    return undefined;
  }

  private getProviderConfig(provider: OAuthProvider) {
    return {
      clientId: provider.clientId,
      clientSecret: provider.clientSecret,
      callbackUrl: this.getCallbackUrl(provider),
      scopes: provider.scopes,
      authorizationUrl: provider.authorizationUrl,
      tokenUrl: provider.tokenUrl,
      userInfoUrl: provider.userInfoUrl,
      profileFields: provider.profileFields,
    };
  }

  private getCallbackUrl(provider: OAuthProvider): string {
    const providerKey = String(provider.type || '').toLowerCase();
    return this.urlBuilderService.buildOAuthCallbackUrl(providerKey);
  }

  private hasConfigurationChanged(currentConfig: any, newConfig: any): boolean {
    // Simple comparison for now, can be expanded with more detailed checks
    return (
      currentConfig.clientId !== newConfig.clientId ||
      currentConfig.clientSecret !== newConfig.clientSecret ||
      currentConfig.callbackUrl !== newConfig.callbackUrl ||
      JSON.stringify(currentConfig.scopes) !==
      JSON.stringify(newConfig.scopes) ||
      currentConfig.authorizationUrl !== newConfig.authorizationUrl ||
      currentConfig.tokenUrl !== newConfig.tokenUrl ||
      currentConfig.userInfoUrl !== newConfig.userInfoUrl ||
      JSON.stringify(currentConfig.profileFields) !==
      JSON.stringify(newConfig.profileFields)
    );
  }

  /**
   * Check if the registry is initialized
   */
  isRegistryInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get list of currently registered provider IDs
   */
  getRegisteredProviders(): string[] {
    // Return enum keys
    return Array.from(this.registeredProviders.keys());
  }

  /**
   * Check if a provider is currently registered
   */
  isProviderRegistered(providerId: string): boolean {
    const enumKey = providerId.toUpperCase();
    return this.registeredProviders.has(enumKey);
  }

  /**
   * Get OAuth provider strategy configuration by ID
   */
  getProviderConfiguration(providerId: string): ProviderStrategyConfig | null {
    if (!this.isInitialized) {
      this.logger.warn(
        `OAuth registry not yet initialized when accessing provider ${providerId}`,
      );
      return null;
    }
    const enumKey = providerId.toUpperCase();
    return this.registeredProviders.get(enumKey) || null;
  }

  /**
   * Public method to manually trigger OAuth providers registration
   */
  async initializeProviders(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeProvidersAsync();
    }
  }
}
