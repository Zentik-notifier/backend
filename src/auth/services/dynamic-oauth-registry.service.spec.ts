import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DynamicOAuthRegistryService } from './dynamic-oauth-registry.service';
import { OAuthProvidersService } from '../../oauth-providers/oauth-providers.service';
import { AuthService } from '../auth.service';
import { UrlBuilderService } from '../../common/services/url-builder.service';
import { OAuthProvider, OAuthProviderType } from '../../entities';

describe('DynamicOAuthRegistryService', () => {
  let service: DynamicOAuthRegistryService;
  let mockOAuthProvidersService: jest.Mocked<OAuthProvidersService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockModuleRef: jest.Mocked<ModuleRef>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockUrlBuilderService: jest.Mocked<UrlBuilderService>;

  const mockProvider: OAuthProvider = {
    id: '1',
    providerId: 'github',
    name: 'GitHub',
    type: OAuthProviderType.GITHUB,
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    scopes: ['user:email'],
    isEnabled: true,
    callbackUrl: 'http://localhost:3000/auth/github/callback',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as OAuthProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicOAuthRegistryService,
        {
          provide: OAuthProvidersService,
          useValue: {
            setRegistryService: jest.fn(),
            findEnabledProviders: jest.fn(),
            isProviderEnabled: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            findOrCreateUserFromProvider: jest.fn(),
          },
        },
        {
          provide: ModuleRef,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: UrlBuilderService,
          useValue: {
            buildOAuthCallbackUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DynamicOAuthRegistryService>(
      DynamicOAuthRegistryService,
    );
    mockOAuthProvidersService = module.get(OAuthProvidersService);
    mockAuthService = module.get(AuthService);
    mockModuleRef = module.get(ModuleRef);
    mockJwtService = module.get(JwtService);
    mockConfigService = module.get(ConfigService);
    mockUrlBuilderService = module.get(UrlBuilderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateProvider', () => {
    beforeEach(() => {
      // Mock the private methods by making them accessible
      jest
        .spyOn(service as any, 'unregisterProvider')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'registerProvider')
        .mockResolvedValue(undefined);
      jest.spyOn(service as any, 'getProviderConfig').mockReturnValue({
        clientId: 'new-client-id',
        clientSecret: 'new-client-secret',
        callbackUrl: 'http://localhost:3000/auth/github/callback',
        scopes: ['user:email'],
        authorizationUrl: undefined,
        tokenUrl: undefined,
        userInfoUrl: undefined,
        profileFields: undefined,
      });
    });

    it('should deregister provider if it is not currently enabled', async () => {
      const disabledProvider = { ...mockProvider, isEnabled: false };

      await service.updateProvider(disabledProvider);

      expect(service['unregisterProvider']).toHaveBeenCalledWith('GITHUB');
      expect(service['registerProvider']).not.toHaveBeenCalled();
    });

    it('should skip update if configuration has not changed', async () => {
      // Mock the URL builder to return the expected callback URL
      mockUrlBuilderService.buildOAuthCallbackUrl.mockReturnValue('http://localhost:3000/auth/github/callback');
      
      // Mock current configuration to be the same as new configuration
      const currentConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        callbackUrl: 'http://localhost:3000/auth/github/callback',
        scopes: ['user:email'],
        authorizationUrl: undefined,
        tokenUrl: undefined,
        userInfoUrl: undefined,
        profileFields: undefined,
      };

      // Mock the registeredProviders map to return current config
      (service as any).registeredProviders = new Map([
        ['GITHUB', { config: currentConfig }],
      ]);

      // Mock getProviderConfig to return the exact same config
      jest.spyOn(service as any, 'getProviderConfig').mockReturnValue(currentConfig);

      // Mock unregisterProvider and registerProvider to track calls
      const unregisterSpy = jest.spyOn(service as any, 'unregisterProvider').mockResolvedValue(undefined);
      const registerSpy = jest.spyOn(service as any, 'registerProvider').mockResolvedValue(undefined);
      
      await service.updateProvider(mockProvider);

      expect(unregisterSpy).not.toHaveBeenCalled();
      expect(registerSpy).not.toHaveBeenCalled();
    });

    it('should update provider if configuration has changed', async () => {
      // Mock current configuration to be different from new configuration
      const currentConfig = {
        clientId: 'old-client-id',
        clientSecret: 'old-client-secret',
        callbackUrl: 'http://localhost:3000/auth/github/callback',
        scopes: ['user:email'],
        authorizationUrl: undefined,
        tokenUrl: undefined,
        userInfoUrl: undefined,
        profileFields: undefined,
      };

      // Mock the registeredProviders map to return current config
      (service as any).registeredProviders = new Map([
        ['GITHUB', { config: currentConfig }],
      ]);

      await service.updateProvider(mockProvider);

      expect(service['unregisterProvider']).toHaveBeenCalledWith('GITHUB');
      expect(service['registerProvider']).toHaveBeenCalledWith(mockProvider);
    });

    it('should update provider if it is not currently registered', async () => {
      // Mock the registeredProviders map to be empty
      (service as any).registeredProviders = new Map();

      await service.updateProvider(mockProvider);

      expect(service['unregisterProvider']).toHaveBeenCalledWith('GITHUB');
      expect(service['registerProvider']).toHaveBeenCalledWith(mockProvider);
    });
  });

  // ... existing tests ...
});
