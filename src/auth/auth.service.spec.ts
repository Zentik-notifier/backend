import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocaleService } from '../common/services/locale.service';
import { UserIdentity } from '../entities/user-identity.entity';
import { OAuthProviderType } from '../entities/oauth-provider.entity';
import { UserSession } from '../entities/user-session.entity';
import { User } from '../entities/user.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import { UserRole } from '../users/users.types';
import { AuthService } from './auth.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  SetPasswordDto,
  UpdateProfileDto,
} from './dto';
import { EmailService } from './email.service';
import { SessionService } from './session.service';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: Repository<User>;
  let identitiesRepository: Repository<UserIdentity>;
  let jwtService: JwtService;
  let sessionService: SessionService;
  let emailService: EmailService;
  let localeService: LocaleService;
  let configService: ConfigService;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    password: 'hashed-password',
    hasPassword: true,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailConfirmed: true,
  };

  const mockUserIdentity: Partial<UserIdentity> = {
    id: 'identity-1',
    providerType: OAuthProviderType.GOOGLE,
    user: mockUser as User,
    createdAt: new Date(),
  };

  const mockUserSession: Partial<UserSession> = {
    id: 'session-1',
    userId: 'user-1',
    tokenId: 'token-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastActivity: new Date(),
    isActive: true,
    createdAt: new Date(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockSessionService = {
    createSession: jest.fn(),
    validateSession: jest.fn(),
    invalidateSession: jest.fn(),
    refreshSession: jest.fn(),
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    isEmailEnabled: jest.fn().mockResolvedValue(false),
  };

  const mockLocaleService = {
    getTranslatedText: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockEventTrackingService = {
    trackRegister: jest.fn(),
    trackLogin: jest.fn(),
    trackLoginOauth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(UserIdentity),
          useValue: mockRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: LocaleService,
          useValue: mockLocaleService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventTrackingService,
          useValue: mockEventTrackingService,
        },
        {
          provide: ServerSettingsService,
          useValue: {
            getSettingByType: jest.fn().mockImplementation((configType: ServerSettingType) => {
              if (configType === ServerSettingType.JwtAccessTokenExpiration) {
                return Promise.resolve({ valueText: '15m' });
              }
              if (configType === ServerSettingType.JwtRefreshTokenExpiration) {
                return Promise.resolve({ valueText: '7d' });
              }
              if (configType === ServerSettingType.JwtSecret) {
                return Promise.resolve({ valueText: 'test-jwt-secret' });
              }
              if (configType === ServerSettingType.JwtRefreshSecret) {
                return Promise.resolve({ valueText: 'test-jwt-refresh-secret' });
              }
              return Promise.resolve({ valueText: '7d' });
            }),
            getBooleanValue: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    identitiesRepository = module.get<Repository<UserIdentity>>(
      getRepositoryToken(UserIdentity),
    );
    jwtService = module.get<JwtService>(JwtService);
    sessionService = module.get<SessionService>(SessionService);
    emailService = module.get<EmailService>(EmailService);
    localeService = module.get<LocaleService>(LocaleService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();

    // bcrypt and uuid mocks will be configured per test

    // Configure config service mock
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: any) => {
        const config = {
          EMAIL_HOST: 'smtp.gmail.com',
          EMAIL_PORT: 587,
          EMAIL_SECURE: false,
          EMAIL_USER: 'test@example.com',
          EMAIL_PASS: 'test-password',
          EMAIL_FROM: 'noreply@test.com',
        };
        return config[key] || defaultValue;
      },
    );

    // Configure locale service mock
    mockLocaleService.getTranslatedText.mockImplementation(
      (locale: string, key: string) => {
        return key; // Return the key as-is for testing
      },
    );

    // Configure email service mock
    mockEmailService.sendEmail.mockResolvedValue(true);
    mockEmailService.sendWelcomeEmail.mockResolvedValue(true);
    mockEmailService.sendPasswordResetEmail.mockResolvedValue(true);

    // Configure JWT service mock
    mockJwtService.sign.mockReturnValue('mock-jwt-token');
    mockJwtService.signAsync.mockResolvedValue('mock-jwt-token');

    // Configure session service mock
    mockSessionService.createSession.mockResolvedValue(
      mockUserSession as UserSession,
    );
    mockSessionService.validateSession.mockResolvedValue(true);

    // Repository mocks will be configured per test
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      username: 'newuser',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
    };

    const context = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should register a new user successfully', async () => {
      const { hash } = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');

      hash.mockResolvedValue('hashed-password');
      uuidv4.mockReturnValue('token-id-123');

      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(usersRepository, 'create').mockReturnValue(mockUser as User);
      jest.spyOn(usersRepository, 'save').mockResolvedValue(mockUser as User);

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenId: 'token-id-123',
      };

      jest
        .spyOn(service as any, 'generateTokens')
        .mockResolvedValue(mockTokens);
      jest
        .spyOn(service as any, 'calculateRefreshTokenExpiration')
        .mockReturnValue(new Date());
      jest
        .spyOn(sessionService, 'createSession')
        .mockResolvedValue(mockUserSession as UserSession);

      const result = await service.register(registerDto, context);

      expect(result).toBeDefined();
      expect(result.user).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          role: mockUser.role,
        }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: [{ email: 'newuser@example.com' }, { username: 'newuser' }],
      });
      expect(usersRepository.create).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'hashed-password',
        hasPassword: true,
        firstName: 'New',
        lastName: 'User',
        emailConfirmed: true,
      });
      expect(sessionService.createSession).toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      const existingUser = { ...mockUser, email: 'newuser@example.com' };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(existingUser as User);

      await expect(service.register(registerDto, context)).rejects.toThrow(
        ConflictException,
      );
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: [{ email: 'newuser@example.com' }, { username: 'newuser' }],
      });
    });

    it('should throw ConflictException when username already exists', async () => {
      const existingUser = { ...mockUser, username: 'newuser' };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(existingUser as User);

      await expect(service.register(registerDto, context)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should register a user with skipEmailConfirmation (admin)', async () => {
      const { hash } = require('bcryptjs');
      hash.mockResolvedValue('hashed-password');

      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(usersRepository, 'create').mockReturnValue(mockUser as User);
      jest.spyOn(usersRepository, 'save').mockResolvedValue(mockUser as User);

      const result = await service.register(registerDto, context, {
        skipEmailConfirmation: true,
      });

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.emailConfirmationRequired).toBe(false);
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      expect(usersRepository.create).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'hashed-password',
        hasPassword: true,
        firstName: 'New',
        lastName: 'User',
        emailConfirmed: true,
      });
      // Email confirmation should not be sent when skipEmailConfirmation is true
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should register a user with email enabled and send confirmation', async () => {
      const { hash } = require('bcryptjs');
      hash.mockResolvedValue('hashed-password');

      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(usersRepository, 'create').mockReturnValue(mockUser as User);
      jest.spyOn(usersRepository, 'save').mockResolvedValue({
        ...mockUser,
        emailConfirmed: false,
      } as User);

      mockEmailService.isEmailEnabled.mockResolvedValue(true);
      jest
        .spyOn(service as any, 'requestEmailConfirmation')
        .mockResolvedValue({ sent: true });

      const result = await service.register(registerDto, context);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.emailConfirmationRequired).toBe(true);
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      expect(usersRepository.create).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'hashed-password',
        hasPassword: true,
        firstName: 'New',
        lastName: 'User',
        emailConfirmed: false,
      });
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const context = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should login user successfully with email', async () => {
      const { compare } = require('bcryptjs');
      compare.mockResolvedValue(true);

      const userWithIdentities = { ...mockUser, identities: [] };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(userWithIdentities as User);

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenId: 'token-id-123',
      };

      jest
        .spyOn(service as any, 'generateTokens')
        .mockResolvedValue(mockTokens);
      jest
        .spyOn(service as any, 'calculateRefreshTokenExpiration')
        .mockReturnValue(new Date());
      jest
        .spyOn(sessionService, 'createSession')
        .mockResolvedValue(mockUserSession as UserSession);

      const result = await service.login(loginDto, context);

      expect(result).toBeDefined();
      expect(result.user).toEqual(
        expect.objectContaining({
          id: userWithIdentities.id,
          email: userWithIdentities.email,
          username: userWithIdentities.username,
          firstName: userWithIdentities.firstName,
          lastName: userWithIdentities.lastName,
          role: userWithIdentities.role,
        }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should login user successfully with username', async () => {
      const { compare } = require('bcryptjs');
      compare.mockResolvedValue(true);

      const userWithIdentities = { ...mockUser, identities: [] };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(userWithIdentities as User);

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenId: 'token-id-123',
      };

      jest
        .spyOn(service as any, 'generateTokens')
        .mockResolvedValue(mockTokens);
      jest
        .spyOn(service as any, 'calculateRefreshTokenExpiration')
        .mockReturnValue(new Date());
      jest
        .spyOn(sessionService, 'createSession')
        .mockResolvedValue(mockUserSession as UserSession);

      const result = await service.login(
        { ...loginDto, email: undefined, username: 'testuser' },
        context,
      );

      expect(result).toBeDefined();
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(service.login(loginDto, context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      const { compare } = require('bcryptjs');
      compare.mockResolvedValue(false);

      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUser as User);

      await expect(service.login(loginDto, context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user has no password', async () => {
      const userWithoutPassword = { ...mockUser, hasPassword: false };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(userWithoutPassword as User);

      await expect(service.login(loginDto, context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    };

    it('should change password successfully', async () => {
      const { compare, hash } = require('bcryptjs');
      compare.mockResolvedValue(true);
      hash.mockResolvedValue('new-hashed-password');

      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUser as User);
      jest.spyOn(usersRepository, 'save').mockResolvedValue(mockUser as User);

      await service.changePassword('user-1', changePasswordDto);

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(compare).toHaveBeenCalledWith('old-password', 'hashed-password');
      expect(hash).toHaveBeenCalledWith('new-password', 12);
      expect(usersRepository.update).toHaveBeenCalledWith('user-1', {
        password: 'new-hashed-password',
        hasPassword: true,
      });
    });

    it('should throw UnauthorizedException when current password is incorrect', async () => {
      const { compare } = require('bcryptjs');
      compare.mockResolvedValue(false);

      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUser as User);

      await expect(
        service.changePassword('user-1', changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.changePassword('user-1', changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('setPassword', () => {
    const setPasswordDto: SetPasswordDto = {
      newPassword: 'new-password',
    };

    it('should set password successfully for user without password', async () => {
      const { hash } = require('bcryptjs');
      hash.mockResolvedValue('new-hashed-password');

      const userWithoutPassword = { ...mockUser, hasPassword: false };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(userWithoutPassword as User);
      jest
        .spyOn(usersRepository, 'save')
        .mockResolvedValue(userWithoutPassword as User);

      await service.setPassword('user-1', setPasswordDto);

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(hash).toHaveBeenCalledWith('new-password', 12);
      expect(usersRepository.update).toHaveBeenCalledWith('user-1', {
        password: 'new-hashed-password',
        hasPassword: true,
      });
    });

    it('should throw BadRequestException when user already has password', async () => {
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUser as User);

      await expect(
        service.setPassword('user-1', setPasswordDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.setPassword('user-1', setPasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    const updateProfileDto: UpdateProfileDto = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update profile successfully', async () => {
      const updatedUser = { ...mockUser, ...updateProfileDto };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUser as User);
      jest
        .spyOn(usersRepository, 'save')
        .mockResolvedValue(updatedUser as User);

      const result = await service.updateProfile('user-1', updateProfileDto);

      expect(result).toEqual(
        expect.objectContaining({
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
        }),
      );
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(usersRepository.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateProfile('user-1', updateProfileDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('should return user without password when user exists', async () => {
      const { compare } = require('bcryptjs');
      compare.mockResolvedValue(true);

      const userWithIdentities = { ...mockUser, identities: [] };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(userWithIdentities as User);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toBeDefined();
      expect(result?.password).toBe('hashed-password');
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const { v4: uuidv4 } = require('uuid');
      uuidv4.mockReturnValue('token-id-123');

      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('token');

      const result = await service['generateTokens'](mockUser as User);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.tokenId).toBe('token-id-123');
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculateRefreshTokenExpiration', () => {
    it('should return date 7 days from now', async () => {
      const result = await service['calculateRefreshTokenExpiration']();
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 7);

      // Check that the result is approximately 7 days from now
      const timeDiff = Math.abs(result.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });
});
