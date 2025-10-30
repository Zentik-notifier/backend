import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionService } from './session.service';
import { OAuthProviderType } from '../entities/oauth-provider.entity';
import { UserSession } from '../entities/user-session.entity';
import { SessionInfoDto } from './dto/session.dto';

describe('SessionService', () => {
  let service: SessionService;
  let sessionRepository: Repository<UserSession>;

  const mockUserSession: Partial<UserSession> = {
    id: 'session-1',
    userId: 'user-1',
    tokenId: 'token-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    lastActivity: new Date(),
    isActive: true,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    deviceName: 'iPhone',
    operatingSystem: 'iOS 15.0',
    browser: 'Safari',
    loginProvider: OAuthProviderType.LOCAL,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getRepositoryToken(UserSession),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    sessionRepository = module.get<Repository<UserSession>>(
      getRepositoryToken(UserSession),
    );

    jest.clearAllMocks();
  });

  describe('createSession', () => {
    const deviceInfo = {
      deviceName: 'iPhone',
      operatingSystem: 'iOS 15.0',
      browser: 'Safari',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      loginProvider: OAuthProviderType.LOCAL,
    };

    it('should create a new session successfully', async () => {
      jest
        .spyOn(sessionRepository, 'create')
        .mockReturnValue(mockUserSession as UserSession);
      jest
        .spyOn(sessionRepository, 'save')
        .mockResolvedValue(mockUserSession as UserSession);

      const result = await service.createSession(
        'user-1',
        'token-123',
        new Date(),
        deviceInfo,
      );

      expect(result).toEqual(mockUserSession);
      expect(sessionRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        tokenId: 'token-123',
        expiresAt: expect.any(Date),
        lastActivity: expect.any(Date),
        isActive: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceName: 'iPhone',
        operatingSystem: 'iOS 15.0',
        browser: 'Safari',
        loginProvider: OAuthProviderType.LOCAL,
      });
      expect(sessionRepository.save).toHaveBeenCalled();
    });

    it('should update existing session when sessionId is provided', async () => {
      const existingSessionId = 'existing-session-1';
      const deviceInfoWithSessionId = {
        ...deviceInfo,
        sessionId: existingSessionId,
      };
      const updatedSession = { ...mockUserSession, id: existingSessionId };

      jest
        .spyOn(sessionRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);
      jest
        .spyOn(sessionRepository, 'findOne')
        .mockResolvedValue(updatedSession as UserSession);

      const result = await service.createSession(
        'user-1',
        'token-123',
        new Date(),
        deviceInfoWithSessionId,
      );

      expect(result).toEqual(updatedSession);
      expect(sessionRepository.update).toHaveBeenCalledWith(
        { id: existingSessionId, userId: 'user-1' },
        {
          tokenId: 'token-123',
          expiresAt: expect.any(Date),
          lastActivity: expect.any(Date),
          isActive: true,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          deviceName: 'iPhone',
          operatingSystem: 'iOS 15.0',
          browser: 'Safari',
          loginProvider: OAuthProviderType.LOCAL,
        },
      );
    });

    it('should create new session when existing session is not found', async () => {
      const existingSessionId = 'existing-session-1';
      const deviceInfoWithSessionId = {
        ...deviceInfo,
        sessionId: existingSessionId,
      };

      jest
        .spyOn(sessionRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(sessionRepository, 'create')
        .mockReturnValue(mockUserSession as UserSession);
      jest
        .spyOn(sessionRepository, 'save')
        .mockResolvedValue(mockUserSession as UserSession);

      const result = await service.createSession(
        'user-1',
        'token-123',
        new Date(),
        deviceInfoWithSessionId,
      );

      expect(result).toEqual(mockUserSession);
      expect(sessionRepository.create).toHaveBeenCalled();
      expect(sessionRepository.save).toHaveBeenCalled();
    });

    it('should create session with minimal device info', async () => {
      jest
        .spyOn(sessionRepository, 'create')
        .mockReturnValue(mockUserSession as UserSession);
      jest
        .spyOn(sessionRepository, 'save')
        .mockResolvedValue(mockUserSession as UserSession);

      const result = await service.createSession(
        'user-1',
        'token-123',
        new Date(),
      );

      expect(result).toEqual(mockUserSession);
      expect(sessionRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        tokenId: 'token-123',
        expiresAt: expect.any(Date),
        lastActivity: expect.any(Date),
        isActive: true,
        ipAddress: undefined,
        userAgent: undefined,
        deviceName: undefined,
        operatingSystem: undefined,
        browser: undefined,
        loginProvider: undefined,
      });
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session last activity', async () => {
      jest
        .spyOn(sessionRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      await service.updateSessionActivity('token-123');

      expect(sessionRepository.update).toHaveBeenCalledWith(
        { tokenId: 'token-123', isActive: true },
        { lastActivity: expect.any(Date) },
      );
    });
  });

  describe('getUserSessions', () => {
    it('should return user sessions without current session', async () => {
      const sessions = [
        { ...mockUserSession, id: 'session-1' },
        { ...mockUserSession, id: 'session-2' },
      ];

      jest
        .spyOn(sessionRepository, 'find')
        .mockResolvedValue(sessions as UserSession[]);

      const result = await service.getUserSessions('user-1', 'current-token');

      expect(result).toHaveLength(2);
      expect(sessionRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
        order: { lastActivity: 'DESC' },
      });
    });

    it('should return user sessions with current session included', async () => {
      const sessions = [
        { ...mockUserSession, id: 'session-1' },
        { ...mockUserSession, id: 'session-2' },
      ];

      jest
        .spyOn(sessionRepository, 'find')
        .mockResolvedValue(sessions as UserSession[]);

      const result = await service.getUserSessions('user-1');

      expect(result).toHaveLength(2);
      expect(sessionRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
        order: { lastActivity: 'DESC' },
      });
    });

    it('should return empty array when no sessions found', async () => {
      jest.spyOn(sessionRepository, 'find').mockResolvedValue([]);

      const result = await service.getUserSessions('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      jest
        .spyOn(sessionRepository, 'update')
        .mockResolvedValue({ affected: 5 } as any);

      await service.cleanupExpiredSessions();

      expect(sessionRepository.update).toHaveBeenCalledWith(
        {
          isActive: true,
          expiresAt: expect.any(Object),
        },
        { isActive: false },
      );
    });
  });
});
