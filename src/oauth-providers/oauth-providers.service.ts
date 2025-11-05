import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthProvider, OAuthProviderType } from '../entities';
import {
  CreateOAuthProviderDto,
  OAuthProviderPublicDto,
  UpdateOAuthProviderDto,
} from './dto/index';

@Injectable()
export class OAuthProvidersService {
  private readonly logger = new Logger(OAuthProvidersService.name);

  constructor(
    @InjectRepository(OAuthProvider)
    private readonly oauthProvidersRepository: Repository<OAuthProvider>,
  ) { }

  private toEnumFromKey(key: string): OAuthProviderType | null {
    if (!key) return null;
    const upper = key.toUpperCase();
    return (OAuthProviderType as any)[upper] ?? null;
  }

  private getProviderKey(provider: OAuthProvider): string {
    let providerKey = String(provider.type || '').toLowerCase();

    // For custom providers, use customTypeId from additionalConfig if available
    if (provider.type === OAuthProviderType.CUSTOM) {

      if (provider.additionalConfig) {
        try {
          const config = JSON.parse(provider.additionalConfig);

          if (config.customTypeId) {
            providerKey = config.customTypeId;
          } else {
            providerKey = provider.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            this.logger.warn(`⚠️ No customTypeId found for ${provider.name}, using sanitized name: ${providerKey}`);
          }
        } catch (error) {
          // Fallback: use a sanitized version of the provider name as providerKey
          providerKey = provider.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          this.logger.error(`❌ Failed to parse additionalConfig for ${provider.name}, using sanitized name: ${providerKey}`, error);
        }
      } else {
        providerKey = provider.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        this.logger.warn(`⚠️ Custom provider ${provider.name} has no additionalConfig, using sanitized name: ${providerKey}`);
      }
    }

    return providerKey;
  }

  // Method to be called by registry service to get notified of changes
  private registryService: any = null;

  setRegistryService(registryService: any) {
    this.registryService = registryService;
  }

  async create(createOAuthProviderDto: CreateOAuthProviderDto): Promise<OAuthProvider> {
    // Ensure uniqueness by type
    const existingProvider = await this.oauthProvidersRepository.findOne({
      where: { type: createOAuthProviderDto.type },
    });
    if (existingProvider) {
      throw new Error(`OAuth provider '${createOAuthProviderDto.type}' already exists`);
    }

    const provider = this.oauthProvidersRepository.create(createOAuthProviderDto);
    const savedProvider = await this.oauthProvidersRepository.save(provider);

    // Notify registry if available
    if (this.registryService && savedProvider.isEnabled) {
      await this.registryService.registerProvider(savedProvider);
    }

    return savedProvider;
  }

  async findAll(): Promise<OAuthProvider[]> {
    const providers = await this.oauthProvidersRepository.find({
      order: { createdAt: 'DESC' },
    });

    return providers;
  }

  async findOne(id: string): Promise<OAuthProvider> {
    const provider = await this.oauthProvidersRepository.findOne({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException(`OAuth provider with ID '${id}' not found`);
    }

    return provider;
  }

  async findByProviderId(providerId: string): Promise<OAuthProvider | null> {
    // First try to find by standard type enum
    const enumVal = this.toEnumFromKey(providerId);
    if (enumVal) {
      // For non-custom providers, find by type
      if (enumVal !== OAuthProviderType.CUSTOM) {
        const provider = await this.oauthProvidersRepository.findOne({ where: { type: enumVal } });
        return provider;
      }

      // For "custom" key, return the first custom provider (backward compatibility)
      if (providerId.toLowerCase() === 'custom') {
        const provider = await this.oauthProvidersRepository.findOne({ where: { type: OAuthProviderType.CUSTOM } });
        return provider;
      }
    }

    // For custom providers with customTypeId, search in additionalConfig
    const customProviders = await this.oauthProvidersRepository.find({
      where: { type: OAuthProviderType.CUSTOM }
    });

    for (const provider of customProviders) {
      if (provider.additionalConfig) {
        try {
          const config = JSON.parse(provider.additionalConfig);
          if (config.customTypeId === providerId) {
            return provider;
          }
        } catch (error) {
          this.logger.warn(`⚠️ Failed to parse additionalConfig for provider ${provider.name}:`, error);
          // Skip providers with invalid additionalConfig
        }
      } else {
        // Check if the sanitized name matches
        const sanitizedName = provider.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (sanitizedName === providerId) {
          return provider;
        }
      }
    }

    this.logger.warn(`⚠️ No provider found for ID: ${providerId}`);
    return null;
  }

  async isProviderEnabled(providerKey: string): Promise<boolean> {
    this.logger.debug(`🔍 Checking if provider is enabled: ${providerKey}`);
    const enumVal = this.toEnumFromKey(providerKey);
    if (!enumVal) {
      this.logger.debug(`🔍 Provider key ${providerKey} not found in enum`);
      return false;
    }
    const provider = await this.oauthProvidersRepository.findOne({
      where: { type: enumVal },
      select: ['isEnabled'],
    });
    const isEnabled = !!provider?.isEnabled;
    this.logger.debug(`🔍 Provider ${providerKey} enabled status: ${isEnabled}`);
    return isEnabled;
  }

  async findEnabledProviders(): Promise<OAuthProvider[]> {
    const providers = await this.oauthProvidersRepository.find({
      where: { isEnabled: true },
      order: { createdAt: 'DESC' },
    });

    return providers;
  }

  async findEnabledProvidersPublic(): Promise<OAuthProviderPublicDto[]> {
    const providers = await this.oauthProvidersRepository.find({
      where: { isEnabled: true },
      order: { createdAt: 'DESC' },
    });

    // Map to public DTO, excluding sensitive information
    const publicProviders: OAuthProviderPublicDto[] = providers.map((provider) => {
      const providerKey = this.getProviderKey(provider);
      return {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        iconUrl: provider.iconUrl,
        color: provider.color,
        textColor: provider.textColor,
        providerKey,
      };
    });

    return publicProviders;
  }

  async update(
    id: string,
    updateOAuthProviderDto: UpdateOAuthProviderDto,
  ): Promise<OAuthProvider> {
    const provider = await this.findOne(id);


    Object.assign(provider, updateOAuthProviderDto);
    const updatedProvider = await this.oauthProvidersRepository.save(provider);

    // Notify registry if available
    if (this.registryService) {
      if (updatedProvider.isEnabled) {
        await this.registryService.updateProvider(updatedProvider);
      } else {
        const key = this.getProviderKey(updatedProvider);
        await this.registryService.unregisterProvider(key);
      }
    }

    return updatedProvider;
  }

  async remove(id: string): Promise<void> {
    const provider = await this.findOne(id);
    await this.oauthProvidersRepository.remove(provider);

    // Notify registry if available
    if (this.registryService) {
      const key = this.getProviderKey(provider);
      await this.registryService.unregisterProvider(key);
    }
  }

  async toggleEnabled(id: string): Promise<OAuthProvider> {
    const provider = await this.findOne(id);
    provider.isEnabled = !provider.isEnabled;

    const updatedProvider = await this.oauthProvidersRepository.save(provider);

    // Notify registry if available
    if (this.registryService) {
      if (updatedProvider.isEnabled) {
        await this.registryService.registerProvider(updatedProvider);
      } else {
        const key = this.getProviderKey(updatedProvider);
        await this.registryService.unregisterProvider(key);
      }
    }

    return updatedProvider;
  }

  async getProviderConfig(providerKey: string): Promise<{
    clientId: string;
    clientSecret: string;
    callbackUrl?: string;
    scopes: string[];
    type: OAuthProviderType;
    authorizationUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
    profileFields?: string[];
    additionalConfig?: any;
  } | null> {
    this.logger.debug(`🔍 Getting provider config for key: ${providerKey}`);
    const provider = await this.findByProviderId(providerKey);

    if (!provider) {
      this.logger.warn(`⚠️ Provider not found for key: ${providerKey}`);
      return null;
    }

    if (!provider.isEnabled) {
      this.logger.warn(`⚠️ Provider ${provider.name} is disabled`);
      return null;
    }

    this.logger.log(`✅ Returning config for provider: ${provider.name} (${provider.type})`);
    this.logger.debug(`🔍 Provider config - clientId: ${provider.clientId ? '[SET]' : '[NOT SET]'}, callbackUrl: ${provider.callbackUrl}`);

    return {
      clientId: provider.clientId,
      clientSecret: provider.clientSecret,
      callbackUrl: provider.callbackUrl,
      scopes: provider.scopes,
      type: provider.type,
      authorizationUrl: provider.authorizationUrl,
      tokenUrl: provider.tokenUrl,
      userInfoUrl: provider.userInfoUrl,
      profileFields: provider.profileFields,
      additionalConfig: provider.additionalConfig
        ? JSON.parse(provider.additionalConfig)
        : undefined,
    };
  }
}
