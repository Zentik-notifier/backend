import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAccessToken } from '../entities/user-access-token.entity';
import { User } from '../entities/user.entity';
import { AccessTokenService } from './access-token.service';
import { CreateAccessTokenDto } from './dto/auth.dto';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
}));

describe('AccessTokenService', () => {
  let service: AccessTokenService;
  let accessTokenRepository: Repository<UserAccessToken>;
  let jwtService: JwtService;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
  };

  const mockUserAccessToken: Partial<UserAccessToken> = {
    id: 'token-1',
    name: 'Test Token',
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    scopes: ['read', 'write'],
    userId: 'user-1',
    user: mockUser as User,
    createdAt: new Date(),
    lastUsed: new Date(),
    isExpired: false,
  };

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenService,
        {
          provide: getRepositoryToken(UserAccessToken),
          useValue: mockRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AccessTokenService>(AccessTokenService);
    accessTokenRepository = module.get<Repository<UserAccessToken>>(
      getRepositoryToken(UserAccessToken),
    );
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('createAccessToken', () => {
    const createDto: CreateAccessTokenDto = {
      name: 'Test Token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      scopes: ['read', 'write'],
    };

    it('should create access token successfully', async () => {
      const { randomBytes } = require('crypto');
      const { hash } = require('bcryptjs');

      randomBytes.mockReturnValue(Buffer.from('random-token-bytes'));
      hash.mockResolvedValue('hashed-token');

      jest
        .spyOn(accessTokenRepository, 'create')
        .mockReturnValue(mockUserAccessToken as UserAccessToken);
      jest
        .spyOn(accessTokenRepository, 'save')
        .mockResolvedValue(mockUserAccessToken as UserAccessToken);

      const result = await service.createAccessToken('user-1', createDto);

      expect(result).toBeDefined();
      expect(result.token).toMatch(/^zat_/);
      expect(result.id).toBe('token-1');
      expect(result.name).toBe('Test Token');
      expect(result.expiresAt?.getTime()).toBeCloseTo(
        createDto.expiresAt?.getTime() || 0,
        -2,
      );
      expect(result.createdAt).toBeDefined();

      expect(randomBytes).toHaveBeenCalledWith(32);
      expect(hash).toHaveBeenCalledWith(
        '72616e646f6d2d746f6b656e2d6279746573',
        10,
      );
      expect(accessTokenRepository.create).toHaveBeenCalledWith({
        name: 'Test Token',
        tokenHash: 'hashed-token',
        expiresAt: createDto.expiresAt,
        scopes: ['read', 'write'],
        userId: 'user-1',
      });
      expect(accessTokenRepository.save).toHaveBeenCalled();
    });
  });

  describe('validateAccessToken', () => {
    it('should validate token successfully and return user', async () => {
      const { compare } = require('bcryptjs');
      compare.mockResolvedValue(true);

      const tokens = [mockUserAccessToken];
      jest
        .spyOn(accessTokenRepository, 'find')
        .mockResolvedValue(tokens as UserAccessToken[]);
      jest
        .spyOn(accessTokenRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await service.validateAccessToken('zat_valid-token');

      expect(result).toEqual(mockUser);
      expect(compare).toHaveBeenCalledWith('valid-token', 'hashed-token');
      expect(accessTokenRepository.update).toHaveBeenCalledWith('token-1', {
        lastUsed: expect.any(Date),
      });
    });

    it('should validate token without prefix', async () => {
      const { compare } = require('bcryptjs');
      compare.mockResolvedValue(true);

      const tokens = [mockUserAccessToken];
      jest
        .spyOn(accessTokenRepository, 'find')
        .mockResolvedValue(tokens as UserAccessToken[]);
      jest
        .spyOn(accessTokenRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await service.validateAccessToken('valid-token');

      expect(result).toEqual(mockUser);
      expect(compare).toHaveBeenCalledWith('valid-token', 'hashed-token');
    });

    it('should return null for expired token', async () => {
      const expiredToken = {
        ...mockUserAccessToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      const tokens = [expiredToken];
      jest
        .spyOn(accessTokenRepository, 'find')
        .mockResolvedValue(tokens as UserAccessToken[]);

      const result = await service.validateAccessToken('zat_expired-token');

      expect(result).toBeNull();
    });

    it('should return null for invalid token hash', async () => {
      const { compare } = require('bcryptjs');
      compare.mockResolvedValue(false);

      const tokens = [mockUserAccessToken];
      jest
        .spyOn(accessTokenRepository, 'find')
        .mockResolvedValue(tokens as UserAccessToken[]);

      const result = await service.validateAccessToken('zat_invalid-token');

      expect(result).toBeNull();
    });

    it('should return null when no tokens found', async () => {
      jest.spyOn(accessTokenRepository, 'find').mockResolvedValue([]);

      const result = await service.validateAccessToken('zat_any-token');

      expect(result).toBeNull();
    });
  });

  describe('getUserAccessTokens', () => {
    it('should return user access tokens', async () => {
      const tokens = [
        { ...mockUserAccessToken, id: 'token-1' },
        { ...mockUserAccessToken, id: 'token-2' },
      ];

      jest
        .spyOn(accessTokenRepository, 'find')
        .mockResolvedValue(tokens as UserAccessToken[]);

      const result = await service.getUserAccessTokens('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('token-1');
      expect(result[1].id).toBe('token-2');
      expect(accessTokenRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when no tokens found', async () => {
      jest.spyOn(accessTokenRepository, 'find').mockResolvedValue([]);

      const result = await service.getUserAccessTokens('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('revokeAccessToken', () => {
    it('should revoke access token successfully', async () => {
      jest
        .spyOn(accessTokenRepository, 'findOne')
        .mockResolvedValue(mockUserAccessToken as UserAccessToken);
      jest
        .spyOn(accessTokenRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await service.revokeAccessToken('user-1', 'token-1');

      expect(result).toBe(true);
      expect(accessTokenRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'token-1', userId: 'user-1' },
      });
      expect(accessTokenRepository.delete).toHaveBeenCalledWith({
        id: 'token-1',
        userId: 'user-1',
      });
    });

    it('should throw NotFoundException when token not found or does not belong to user', async () => {
      jest
        .spyOn(accessTokenRepository, 'findOne')
        .mockResolvedValue(null);

      await expect(
        service.revokeAccessToken('user-1', 'nonexistent-token'),
      ).rejects.toThrow(NotFoundException);
      expect(accessTokenRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'nonexistent-token', userId: 'user-1' },
      });
      expect(accessTokenRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllAccessTokens', () => {
    it('should revoke all access tokens successfully', async () => {
      jest
        .spyOn(accessTokenRepository, 'count')
        .mockResolvedValue(3);
      jest
        .spyOn(accessTokenRepository, 'delete')
        .mockResolvedValue({ affected: 3 } as any);

      const result = await service.revokeAllAccessTokens('user-1');

      expect(result).toBe(true);
      expect(accessTokenRepository.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(accessTokenRepository.delete).toHaveBeenCalledWith({
        userId: 'user-1',
      });
    });

    it('should return false when user has no tokens to revoke', async () => {
      jest
        .spyOn(accessTokenRepository, 'count')
        .mockResolvedValue(0);

      const result = await service.revokeAllAccessTokens('user-1');

      expect(result).toBe(false);
      expect(accessTokenRepository.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(accessTokenRepository.delete).not.toHaveBeenCalled();
    });
  });
});
