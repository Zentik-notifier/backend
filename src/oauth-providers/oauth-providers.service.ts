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
  ) {}

  // Method to be called by registry service to get notified of changes
  private registryService: any = null;

  setRegistryService(registryService: any) {
    this.registryService = registryService;
  }

  async create(
    createOAuthProviderDto: CreateOAuthProviderDto,
  ): Promise<OAuthProvider> {
    // Check if provider with same providerId already exists
    const existingProvider = await this.oauthProvidersRepository.findOne({
      where: { providerId: createOAuthProviderDto.providerId },
    });

    if (existingProvider) {
      throw new Error(
        `OAuth provider with providerId '${createOAuthProviderDto.providerId}' already exists`,
      );
    }

    const provider = this.oauthProvidersRepository.create(
      createOAuthProviderDto,
    );
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
    const provider = await this.oauthProvidersRepository.findOne({
      where: { providerId },
    });

    return provider;
  }

  async isProviderEnabled(providerId: string): Promise<boolean> {
    const provider = await this.oauthProvidersRepository.findOne({
      where: { providerId },
      select: ['isEnabled'],
    });

    return provider?.isEnabled || false;
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
    const publicProviders: OAuthProviderPublicDto[] = providers.map(
      (provider) => ({
        id: provider.id,
        name: provider.name,
        providerId: provider.providerId,
        type: provider.type,
        iconUrl: provider.iconUrl,
        color: provider.color,
        textColor: provider.textColor,
      }),
    );

    return publicProviders;
  }

  async update(
    id: string,
    updateOAuthProviderDto: UpdateOAuthProviderDto,
  ): Promise<OAuthProvider> {
    const provider = await this.findOne(id);

    // If updating providerId, check for conflicts
    if (
      updateOAuthProviderDto.providerId &&
      updateOAuthProviderDto.providerId !== provider.providerId
    ) {
      const existingProvider = await this.oauthProvidersRepository.findOne({
        where: { providerId: updateOAuthProviderDto.providerId },
      });

      if (existingProvider) {
        throw new Error(
          `OAuth provider with providerId '${updateOAuthProviderDto.providerId}' already exists`,
        );
      }
    }

    Object.assign(provider, updateOAuthProviderDto);
    const updatedProvider = await this.oauthProvidersRepository.save(provider);

    // Notify registry if available
    if (this.registryService) {
      if (updatedProvider.isEnabled) {
        await this.registryService.updateProvider(updatedProvider);
      } else {
        await this.registryService.unregisterProvider(
          updatedProvider.providerId,
        );
      }
    }

    return updatedProvider;
  }

  async remove(id: string): Promise<void> {
    const provider = await this.findOne(id);
    await this.oauthProvidersRepository.remove(provider);

    // Notify registry if available
    if (this.registryService) {
      await this.registryService.unregisterProvider(provider.providerId);
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
        await this.registryService.unregisterProvider(
          updatedProvider.providerId,
        );
      }
    }

    return updatedProvider;
  }

  // Note: initializePredefinedProviders method moved to OAuthProvidersInitService
  // This method is now handled automatically at server startup

  async getProviderConfig(providerId: string): Promise<{
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
    const provider = await this.findByProviderId(providerId);

    if (!provider || !provider.isEnabled) {
      return null;
    }

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
