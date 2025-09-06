import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthProvidersService } from './oauth-providers.service';
import { OAuthProvider, OAuthProviderType } from '../entities';
import { CreateOAuthProviderDto, UpdateOAuthProviderDto } from './dto/index';

describe('OAuthProvidersService', () => {
  let service: OAuthProvidersService;
  let repository: Repository<OAuthProvider>;

  const mockOAuthProvider: OAuthProvider = {
    id: 'test-id',
    providerId: 'github',
    name: 'GitHub',
    type: OAuthProviderType.GITHUB,
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    scopes: ['user:email'],
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as OAuthProvider;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthProvidersService,
        {
          provide: getRepositoryToken(OAuthProvider),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OAuthProvidersService>(OAuthProvidersService);
    repository = module.get<Repository<OAuthProvider>>(
      getRepositoryToken(OAuthProvider),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new OAuth provider', async () => {
      const createDto: CreateOAuthProviderDto = {
        name: 'Test Provider',
        providerId: 'test-provider',
        type: OAuthProviderType.CUSTOM,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        scopes: ['profile', 'email'],
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        userInfoUrl: 'https://example.com/oauth/userinfo',
        profileFields: ['id', 'email', 'name'],
      };

      const mockProvider = {
        id: 'test-id',
        ...createDto,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockProvider);
      mockRepository.save.mockResolvedValue(mockProvider);

      const result = await service.create(createDto);

      expect(result).toEqual(mockProvider);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { providerId: createDto.providerId },
      });
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockProvider);
    });

    it('should throw error if provider with same providerId exists', async () => {
      const createDto: CreateOAuthProviderDto = {
        name: 'Test Provider',
        providerId: 'test-provider',
        type: OAuthProviderType.CUSTOM,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        scopes: ['profile', 'email'],
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        userInfoUrl: 'https://example.com/oauth/userinfo',
        profileFields: ['id', 'email', 'name'],
      };

      mockRepository.findOne.mockResolvedValue({ id: 'existing-id' });

      await expect(service.create(createDto)).rejects.toThrow(
        "OAuth provider with providerId 'test-provider' already exists",
      );
    });
  });

  describe('findAll', () => {
    it('should return all OAuth providers', async () => {
      const mockProviders = [
        { id: '1', name: 'Provider 1' },
        { id: '2', name: 'Provider 2' },
      ];

      mockRepository.find.mockResolvedValue(mockProviders);

      const result = await service.findAll();

      expect(result).toEqual(mockProviders);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a provider by ID', async () => {
      const mockProvider = { id: 'test-id', name: 'Test Provider' };

      mockRepository.findOne.mockResolvedValue(mockProvider);

      const result = await service.findOne('test-id');

      expect(result).toEqual(mockProvider);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should throw NotFoundException if provider not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        "OAuth provider with ID 'non-existent' not found",
      );
    });
  });

  describe('findByProviderId', () => {
    it('should return a provider by providerId', async () => {
      const mockProvider = {
        id: 'test-id',
        providerId: 'github',
        name: 'GitHub',
      };

      mockRepository.findOne.mockResolvedValue(mockProvider);

      const result = await service.findByProviderId('github');

      expect(result).toEqual(mockProvider);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { providerId: 'github' },
      });
    });

    it('should return null if provider not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByProviderId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findEnabledProviders', () => {
    it('should return only enabled providers', async () => {
      const mockProviders = [
        { id: '1', name: 'Provider 1', isEnabled: true },
        { id: '2', name: 'Provider 2', isEnabled: false },
      ];

      mockRepository.find.mockResolvedValue(mockProviders);

      const result = await service.findEnabledProviders();

      expect(result).toEqual(mockProviders);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isEnabled: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('update', () => {
    it('should update an existing provider', async () => {
      const updateDto: UpdateOAuthProviderDto = {
        name: 'Updated Provider',
      };

      const existingProvider = {
        id: 'test-id',
        name: 'Old Name',
        providerId: 'test-provider',
        type: OAuthProviderType.CUSTOM,
        clientId: 'old-client-id',
        clientSecret: 'old-client-secret',
        scopes: ['profile'],
        isEnabled: true,
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        userInfoUrl: 'https://example.com/oauth/userinfo',
        profileFields: ['id', 'email'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedProvider = { ...existingProvider, ...updateDto };

      mockRepository.findOne.mockResolvedValue(existingProvider);
      mockRepository.save.mockResolvedValue(updatedProvider);

      const result = await service.update('test-id', updateDto);

      expect(result).toEqual(updatedProvider);
      expect(mockRepository.save).toHaveBeenCalledWith(updatedProvider);
    });
  });

  describe('remove', () => {
    it('should remove a provider', async () => {
      const mockProvider = { id: 'test-id', name: 'Test Provider' };

      mockRepository.findOne.mockResolvedValue(mockProvider);
      mockRepository.remove.mockResolvedValue(mockProvider);

      await service.remove('test-id');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(mockProvider);
    });
  });

  describe('toggleEnabled', () => {
    it('should toggle provider enabled status', async () => {
      const mockProvider = {
        id: 'test-id',
        name: 'Test Provider',
        isEnabled: true,
      };

      const toggledProvider = { ...mockProvider, isEnabled: false };

      mockRepository.findOne.mockResolvedValue(mockProvider);
      mockRepository.save.mockResolvedValue(toggledProvider);

      const result = await service.toggleEnabled('test-id');

      expect(result.isEnabled).toBe(false);
      expect(mockRepository.save).toHaveBeenCalledWith(toggledProvider);
    });
  });

  describe('isProviderEnabled', () => {
    it('should return true when provider is enabled', async () => {
      const enabledProvider = { ...mockOAuthProvider, isEnabled: true };
      mockRepository.findOne.mockResolvedValue(enabledProvider);

      const result = await service.isProviderEnabled('github');
      expect(result).toBe(true);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { providerId: 'github' },
        select: ['isEnabled'],
      });
    });

    it('should return false when provider is disabled', async () => {
      const disabledProvider = { ...mockOAuthProvider, isEnabled: false };
      mockRepository.findOne.mockResolvedValue(disabledProvider);

      const result = await service.isProviderEnabled('github');
      expect(result).toBe(false);
    });

    it('should return false when provider does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.isProviderEnabled('nonexistent');
      expect(result).toBe(false);
    });
  });
});
