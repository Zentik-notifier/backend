import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bucket } from '../entities/bucket.entity';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { User } from '../entities/user.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import { UserSetting } from '../entities/user-setting.entity';
import { SystemAccessToken } from '../system-access-token/system-access-token.entity';
import { AdminSubscription } from '../entities/admin-subscription.entity';
import {
  DevicePlatform,
  RegisterDeviceDto,
  UpdateDeviceTokenDto,
  UpdateUserDeviceDto,
} from './dto';
import { UsersService } from './users.service';
import { UserRole } from './users.types';

// Mock crypto utils
jest.mock('src/common/utils/cryptoUtils', () => ({
  generateRSAKeyPair: jest.fn().mockResolvedValue({
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
  }),
}));

// Mock web-push
jest.mock('web-push', () => ({
  generateVAPIDKeys: jest.fn().mockReturnValue({
    publicKey: 'mock-vapid-public-key',
    privateKey: 'mock-vapid-private-key',
  }),
}));

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: Repository<User>;
  let userDevicesRepository: Repository<UserDevice>;
  let bucketsRepository: Repository<Bucket>;
  let notificationsRepository: Repository<Notification>;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserDevice: Partial<UserDevice> = {
    id: 'device-1',
    userId: 'user-1',
    deviceToken: 'device-token-1',
    platform: DevicePlatform.IOS,
    deviceName: 'iPhone',
    deviceModel: 'iPhone 12',
    osVersion: '15.0',
    lastUsed: new Date(),
    createdAt: new Date(),
  };

  const mockUsersRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserDevicesRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockBucketsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockNotificationsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserSettingsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockSystemAccessTokensRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockAdminSubscriptionRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockEventTrackingService = {
    trackDeviceRegister: jest.fn(),
    trackDeviceUnregister: jest.fn(),
    trackAccountDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: getRepositoryToken(UserDevice),
          useValue: mockUserDevicesRepository,
        },
        {
          provide: getRepositoryToken(Bucket),
          useValue: mockBucketsRepository,
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationsRepository,
        },
        {
          provide: getRepositoryToken(UserSetting),
          useValue: mockUserSettingsRepository,
        },
        {
          provide: getRepositoryToken(SystemAccessToken),
          useValue: mockSystemAccessTokensRepository,
        },
        {
          provide: getRepositoryToken(AdminSubscription),
          useValue: mockAdminSubscriptionRepository,
        },
        {
          provide: EventTrackingService,
          useValue: mockEventTrackingService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    userDevicesRepository = module.get<Repository<UserDevice>>(
      getRepositoryToken(UserDevice),
    );
    bucketsRepository = module.get<Repository<Bucket>>(
      getRepositoryToken(Bucket),
    );
    notificationsRepository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );

    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('should return a user when found', async () => {
      const mockUserWithRelations = {
        ...mockUser,
        devices: [],
        buckets: [],
        identities: [],
      };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUserWithRelations as User);

      const result = await service.findOne('user-1');

      expect(result).toEqual(mockUserWithRelations);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: ['devices', 'buckets', 'identities'],
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
        relations: ['devices', 'buckets', 'identities'],
      });
    });
  });

  describe('findByIdentifier', () => {
    it('should find user by userId', async () => {
      const mockUserWithIdentities = { ...mockUser, identities: [] };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUserWithIdentities as User);

      const result = await service.findByIdentifier({ userId: 'user-1' });

      expect(result).toEqual(mockUserWithIdentities);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: ['identities'],
      });
    });

    it('should find user by email', async () => {
      const mockUserWithIdentities = { ...mockUser, identities: [] };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUserWithIdentities as User);

      const result = await service.findByIdentifier({
        email: 'test@example.com',
      });

      expect(result).toEqual(mockUserWithIdentities);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        relations: ['identities'],
      });
    });

    it('should find user by username', async () => {
      const mockUserWithIdentities = { ...mockUser, identities: [] };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUserWithIdentities as User);

      const result = await service.findByIdentifier({ username: 'testuser' });

      expect(result).toEqual(mockUserWithIdentities);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        relations: ['identities'],
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.findByIdentifier({ email: 'nonexistent@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all users with relations', async () => {
      const mockUsers = [
        { ...mockUser, devices: [], buckets: [], identities: [] },
      ];
      jest
        .spyOn(usersRepository, 'find')
        .mockResolvedValue(mockUsers as User[]);

      const result = await service.findAll();

      expect(result).toEqual(mockUsers);
      expect(usersRepository.find).toHaveBeenCalledWith({
        relations: ['devices', 'buckets', 'identities'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const mockUserToUpdate = { ...mockUser };
      const updatedUser = { ...mockUser, role: UserRole.ADMIN };

      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUserToUpdate as User);
      jest
        .spyOn(usersRepository, 'save')
        .mockResolvedValue(updatedUser as User);

      const result = await service.updateUserRole('user-1', UserRole.ADMIN);

      expect(result.role).toBe(UserRole.ADMIN);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(usersRepository.save).toHaveBeenCalledWith(updatedUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateUserRole('nonexistent', UserRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('registerDevice', () => {
    const registerDeviceDto: RegisterDeviceDto = {
      deviceToken: 'new-device-token',
      platform: DevicePlatform.IOS,
      deviceName: 'iPhone',
      deviceModel: 'iPhone 12',
      osVersion: '15.0',
    };

    it('should register new iOS device successfully', async () => {
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUser as User);
      jest.spyOn(userDevicesRepository, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(userDevicesRepository, 'create')
        .mockReturnValue(mockUserDevice as UserDevice);
      jest
        .spyOn(userDevicesRepository, 'save')
        .mockResolvedValue(mockUserDevice as UserDevice);

      const result = await service.registerDevice('user-1', registerDeviceDto);

      expect(result).toEqual(mockUserDevice);
      expect(userDevicesRepository.create).toHaveBeenCalled();
      expect(userDevicesRepository.save).toHaveBeenCalled();
    });

    it('should update existing device when device token already exists', async () => {
      const existingDevice = { ...mockUserDevice };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUser as User);
      jest
        .spyOn(userDevicesRepository, 'findOne')
        .mockResolvedValue(existingDevice as UserDevice);
      jest
        .spyOn(userDevicesRepository, 'save')
        .mockResolvedValue(existingDevice as UserDevice);

      const result = await service.registerDevice('user-1', registerDeviceDto);

      expect(result).toEqual(existingDevice);
      expect(userDevicesRepository.save).toHaveBeenCalledWith(existingDevice);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.registerDevice('nonexistent', registerDeviceDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserDevices', () => {
    it('should return user devices', async () => {
      const mockDevices = [mockUserDevice];
      jest
        .spyOn(userDevicesRepository, 'find')
        .mockResolvedValue(mockDevices as UserDevice[]);

      const result = await service.getUserDevices('user-1');

      expect(result).toEqual(mockDevices);
      expect(userDevicesRepository.find).toHaveBeenCalledWith({
        where: { user: { id: 'user-1' } },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('removeDevice', () => {
    it('should remove device successfully', async () => {
      jest
        .spyOn(userDevicesRepository, 'findOne')
        .mockResolvedValue(mockUserDevice as UserDevice);
      jest
        .spyOn(userDevicesRepository, 'remove')
        .mockResolvedValue(mockUserDevice as UserDevice);
      jest
        .spyOn(mockEventTrackingService, 'trackDeviceUnregister')
        .mockResolvedValue(undefined);

      await service.removeDevice('user-1', 'device-1');

      expect(userDevicesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'device-1', user: { id: 'user-1' } },
      });
      expect(userDevicesRepository.remove).toHaveBeenCalledWith(mockUserDevice);
      expect(
        mockEventTrackingService.trackDeviceUnregister,
      ).toHaveBeenCalledWith('user-1', 'device-1');
    });

    it('should throw NotFoundException when device not found', async () => {
      jest.spyOn(userDevicesRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.removeDevice('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when device not owned by user', async () => {
      const deviceNotOwned = { ...mockUserDevice, userId: 'user-2' };
      jest
        .spyOn(userDevicesRepository, 'findOne')
        .mockResolvedValue(deviceNotOwned as UserDevice);

      await expect(service.removeDevice('user-1', 'device-1')).rejects.toThrow(
        'Access denied: device not owned by user',
      );
    });
  });

  describe('updateDeviceToken', () => {
    const updateTokenDto: UpdateDeviceTokenDto = {
      oldDeviceToken: 'old-token',
      newDeviceToken: 'new-token',
    };

    it('should update device token successfully', async () => {
      const deviceToUpdate = { ...mockUserDevice, deviceToken: 'old-token' };
      jest
        .spyOn(userDevicesRepository, 'findOne')
        .mockResolvedValue(deviceToUpdate as UserDevice);
      jest
        .spyOn(userDevicesRepository, 'save')
        .mockResolvedValue(deviceToUpdate as UserDevice);

      const result = await service.updateDeviceToken('user-1', updateTokenDto);

      expect(result.deviceToken).toBe('new-token');
      expect(userDevicesRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when device not found', async () => {
      jest.spyOn(userDevicesRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateDeviceToken('user-1', updateTokenDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when device not owned by user', async () => {
      const deviceNotOwned = { ...mockUserDevice, userId: 'user-2' };
      jest
        .spyOn(userDevicesRepository, 'findOne')
        .mockResolvedValue(deviceNotOwned as UserDevice);

      await expect(
        service.updateDeviceToken('user-1', updateTokenDto),
      ).rejects.toThrow('Access denied: device not owned by user');
    });
  });

  describe('updateUserDevice', () => {
    const updateDeviceDto: UpdateUserDeviceDto = {
      deviceId: 'device-1',
      deviceName: 'Updated iPhone',
      deviceModel: 'iPhone 13',
    };

    it('should update device successfully', async () => {
      const deviceToUpdate = { ...mockUserDevice };
      jest
        .spyOn(userDevicesRepository, 'findOne')
        .mockResolvedValue(deviceToUpdate as UserDevice);
      jest
        .spyOn(userDevicesRepository, 'save')
        .mockResolvedValue(deviceToUpdate as UserDevice);

      const result = await service.updateUserDevice('user-1', updateDeviceDto);

      expect(result).toEqual(deviceToUpdate);
      expect(userDevicesRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when device not found', async () => {
      jest.spyOn(userDevicesRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateUserDevice('user-1', updateDeviceDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when device not owned by user', async () => {
      const deviceNotOwned = { ...mockUserDevice, userId: 'user-2' };
      jest
        .spyOn(userDevicesRepository, 'findOne')
        .mockResolvedValue(deviceNotOwned as UserDevice);

      await expect(
        service.updateUserDevice('user-1', updateDeviceDto),
      ).rejects.toThrow('Access denied: device not owned by user');
    });
  });

  describe('deleteAccount', () => {
    it('should delete account and all associated data successfully', async () => {
      const userWithRelations = { ...mockUser, devices: [], buckets: [] };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(userWithRelations as User);
      jest
        .spyOn(notificationsRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);
      jest
        .spyOn(userDevicesRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);
      jest
        .spyOn(bucketsRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);
      jest
        .spyOn(mockSystemAccessTokensRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteAccount('user-1');

      expect(result.message).toBe(
        'Account and associated data deleted successfully',
      );
      expect(notificationsRepository.delete).toHaveBeenCalledWith({
        userId: 'user-1',
      });
      expect(userDevicesRepository.delete).toHaveBeenCalledWith({
        userId: 'user-1',
      });
      expect(bucketsRepository.delete).toHaveBeenCalledWith({
        user: { id: 'user-1' },
      });
      expect(mockSystemAccessTokensRepository.delete).toHaveBeenCalledWith({
        requesterId: 'user-1',
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(service.deleteAccount('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findDeviceByUserToken', () => {
    it('should find device by user token', async () => {
      jest
        .spyOn(userDevicesRepository, 'findOne')
        .mockResolvedValue(mockUserDevice as UserDevice);

      const result = await service.findDeviceByUserToken(
        'user-1',
        'device-token-1',
      );

      expect(result).toEqual(mockUserDevice);
      expect(userDevicesRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', deviceToken: 'device-token-1' },
        relations: ['user'],
      });
    });

    it('should return null when device not found', async () => {
      jest.spyOn(userDevicesRepository, 'findOne').mockResolvedValue(null);

      const result = await service.findDeviceByUserToken(
        'user-1',
        'nonexistent-token',
      );

      expect(result).toBeNull();
    });
  });

  describe('updateDeviceLastUsed', () => {
    it('should update device last used timestamp', async () => {
      const device = { ...mockUserDevice, userId: 'user-1' };
      jest
        .spyOn(service, 'findDeviceById')
        .mockResolvedValue(device as UserDevice);
      jest
        .spyOn(userDevicesRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      await service.updateDeviceLastUsed('device-1', 'user-1');

      expect(service.findDeviceById).toHaveBeenCalledWith('device-1');
      expect(userDevicesRepository.update).toHaveBeenCalledWith(
        { id: 'device-1' },
        { lastUsed: expect.any(Date) },
      );
    });

    it('should throw ForbiddenException when device not owned by user', async () => {
      const deviceNotOwned = { ...mockUserDevice, userId: 'user-2' };
      jest
        .spyOn(service, 'findDeviceById')
        .mockResolvedValue(deviceNotOwned as UserDevice);

      await expect(
        service.updateDeviceLastUsed('device-1', 'user-1'),
      ).rejects.toThrow('Access denied: device not owned by user');
    });
  });

  describe('getMultipleUserSettings', () => {
    it('should retrieve multiple user settings efficiently', async () => {
      const userId = 'user-1';
      const configTypes = [
        'AutoAddDeleteAction' as any,
        'AutoAddMarkAsReadAction' as any,
        'AutoAddOpenNotificationAction' as any,
      ];

      const mockSettings = [
        {
          id: 'setting-1',
          userId,
          deviceId: null,
          configType: 'AutoAddDeleteAction',
          valueBool: true,
        },
        {
          id: 'setting-2',
          userId,
          deviceId: null,
          configType: 'AutoAddMarkAsReadAction',
          valueBool: false,
        },
      ];

      mockUserSettingsRepository.find.mockResolvedValue(mockSettings as UserSetting[]);

      const result = await service.getMultipleUserSettings(
        userId,
        configTypes,
        null,
      );

      expect(result.size).toBe(3);
      expect(result.get('AutoAddDeleteAction' as any)?.valueBool).toBe(true);
      expect(result.get('AutoAddMarkAsReadAction' as any)?.valueBool).toBe(false);
      expect(result.get('AutoAddOpenNotificationAction' as any)).toBeNull();
      expect(mockUserSettingsRepository.find).toHaveBeenCalledTimes(1);
      // Verify the query structure (TypeORM operators are complex objects)
      const callArgs = mockUserSettingsRepository.find.mock.calls[0][0];
      expect(callArgs.where).toHaveLength(1);
      expect(callArgs.where[0].userId).toBe(userId);
      expect(callArgs.where[0].deviceId).toBeDefined(); // IsNull() operator
      expect(callArgs.where[0].configType).toBeDefined(); // In() operator
    });

    it('should prefer device-specific settings over user-level settings', async () => {
      const userId = 'user-1';
      const deviceId = 'device-1';
      const configTypes = ['AutoAddDeleteAction' as any];

      const mockSettings = [
        {
          id: 'setting-1',
          userId,
          deviceId: null,
          configType: 'AutoAddDeleteAction',
          valueBool: true,
        },
        {
          id: 'setting-2',
          userId,
          deviceId,
          configType: 'AutoAddDeleteAction',
          valueBool: false,
        },
      ];

      mockUserSettingsRepository.find.mockResolvedValue(mockSettings as UserSetting[]);

      const result = await service.getMultipleUserSettings(
        userId,
        configTypes,
        deviceId,
      );

      // Device-specific setting (false) should take precedence over user-level (true)
      expect(result.get('AutoAddDeleteAction' as any)?.valueBool).toBe(false);
    });

    it('should fall back to user-level settings when device-specific not available', async () => {
      const userId = 'user-1';
      const deviceId = 'device-1';
      const configTypes = ['AutoAddDeleteAction' as any];

      const mockSettings = [
        {
          id: 'setting-1',
          userId,
          deviceId: null,
          configType: 'AutoAddDeleteAction',
          valueBool: true,
        },
      ];

      mockUserSettingsRepository.find.mockResolvedValue(mockSettings as UserSetting[]);

      const result = await service.getMultipleUserSettings(
        userId,
        configTypes,
        deviceId,
      );

      // Should fall back to user-level setting
      expect(result.get('AutoAddDeleteAction' as any)?.valueBool).toBe(true);
    });

    it('should return null for settings that do not exist', async () => {
      const userId = 'user-1';
      const configTypes = [
        'AutoAddDeleteAction' as any,
        'NonExistentSetting' as any,
      ];

      const mockSettings = [
        {
          id: 'setting-1',
          userId,
          deviceId: null,
          configType: 'AutoAddDeleteAction',
          valueBool: true,
        },
      ];

      mockUserSettingsRepository.find.mockResolvedValue(mockSettings as UserSetting[]);

      const result = await service.getMultipleUserSettings(
        userId,
        configTypes,
        null,
      );

      expect(result.get('AutoAddDeleteAction' as any)?.valueBool).toBe(true);
      expect(result.get('NonExistentSetting' as any)).toBeNull();
    });

    it('should handle empty settings array', async () => {
      const userId = 'user-1';
      const configTypes = ['AutoAddDeleteAction' as any];

      mockUserSettingsRepository.find.mockResolvedValue([]);

      const result = await service.getMultipleUserSettings(
        userId,
        configTypes,
        null,
      );

      expect(result.size).toBe(1);
      expect(result.get('AutoAddDeleteAction' as any)).toBeNull();
    });
  });
});
