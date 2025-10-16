import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UrlBuilderService } from '../common/services/url-builder.service';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { FirebasePushService } from './firebase-push.service';
import { IOSPushService } from './ios-push.service';
import { NotificationsService } from './notifications.service';
import { WebPushService } from './web-push.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { MessageReminderService } from '../messages/message-reminder.service';
import {
  ExternalNotifyRequestDto,
  ExternalPlatform,
} from './dto/external-notify.dto';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationsRepository: Repository<Notification>;
  let urlBuilderService: UrlBuilderService;
  let usersService: UsersService;
  let messagesService: MessagesService;
  let iosPushService: IOSPushService;
  let firebasePushService: FirebasePushService;
  let webPushService: WebPushService;
  let configService: ConfigService;

  const mockNotification: Partial<Notification> = {
    id: 'notification-1',
    userId: 'user-1',
    userDeviceId: 'device-1',
    readAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
    } as any,
    message: {
      id: 'message-1',
      title: 'Test Message',
      content: 'Test Content',
      bucketId: 'bucket-1',
    } as any,
    userDevice: {
      id: 'device-1',
      deviceName: 'iPhone',
      platform: 'iOS',
    } as any,
  };

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockUrlBuilderService = {
    processNotifications: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
    findDeviceById: jest.fn(),
    findDeviceByUserToken: jest.fn(),
  };

  const mockMessagesService = {
    findOne: jest.fn(),
  };

  const mockIOSPushService = {
    provider: null as any,
    sendPrebuilt: jest.fn(),
    ensureInitialized: jest.fn().mockResolvedValue(undefined),
  };

  const mockFirebasePushService = {
    app: null as any,
    sendPrebuilt: jest.fn(),
    ensureInitialized: jest.fn().mockResolvedValue(undefined),
  };

  const mockWebPushService = {
    configured: false,
    sendPrebuilt: jest.fn(),
    ensureInitialized: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockServerSettingsService = {
    getSettingByType: jest.fn().mockResolvedValue({
      valueBool: true,
      valueText: 'test-value',
    }),
    getStringValue: jest.fn().mockResolvedValue('Local'),
    getBoolValue: jest.fn().mockResolvedValue(true),
    getNumberValue: jest.fn().mockResolvedValue(1000),
  };

  const mockMessageReminderService = {
    cancelRemindersByMessage: jest.fn().mockResolvedValue(undefined),
    createReminder: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(UserDevice),
          useValue: mockRepository,
        },
        {
          provide: UrlBuilderService,
          useValue: mockUrlBuilderService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: IOSPushService,
          useValue: mockIOSPushService,
        },
        {
          provide: FirebasePushService,
          useValue: mockFirebasePushService,
        },
        {
          provide: WebPushService,
          useValue: mockWebPushService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ServerSettingsService,
          useValue: mockServerSettingsService,
        },
        {
          provide: MessageReminderService,
          useValue: mockMessageReminderService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationsRepository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    urlBuilderService = module.get<UrlBuilderService>(UrlBuilderService);
    usersService = module.get<UsersService>(UsersService);
    messagesService = module.get<MessagesService>(MessagesService);
    iosPushService = module.get<IOSPushService>(IOSPushService);
    firebasePushService = module.get<FirebasePushService>(FirebasePushService);
    webPushService = module.get<WebPushService>(WebPushService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();

    // Reset mock service initialization states
    mockIOSPushService.provider = { isInitialized: true };
    mockFirebasePushService.app = { isInitialized: true };
    mockWebPushService.configured = true;
  });

  describe('findByUser', () => {
    it('should return notifications for a specific user', async () => {
      const notifications = [mockNotification];
      const processedNotifications = [
        { ...mockNotification, processedUrl: 'processed-url' },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(notifications);
      mockUrlBuilderService.processNotifications.mockReturnValue(
        processedNotifications,
      );

      const result = await service.findByUser('user-1');

      expect(result).toEqual(processedNotifications);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'notification.userId = :userId',
        { userId: 'user-1' },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'notification.createdAt',
        'DESC',
      );
    });
  });

  describe('findOne', () => {
    it('should return a notification when found', async () => {
      const processedNotification = {
        ...mockNotification,
        processedUrl: 'processed-url',
      };

      jest
        .spyOn(notificationsRepository, 'findOne')
        .mockResolvedValue(mockNotification as Notification);
      mockUrlBuilderService.processNotifications.mockReturnValue([
        processedNotification,
      ]);

      const result = await service.findOne('notification-1', 'user-1');

      expect(result).toEqual(processedNotification);
      expect(notificationsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'notification-1', userId: 'user-1' },
        relations: ['user', 'message', 'message.bucket', 'userDevice'],
      });
      expect(mockUrlBuilderService.processNotifications).toHaveBeenCalledWith([
        mockNotification,
      ]);
    });

    it('should throw NotFoundException when notification not found', async () => {
      jest.spyOn(notificationsRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(notificationsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'nonexistent', userId: 'user-1' },
        relations: ['user', 'message', 'message.bucket', 'userDevice'],
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(mockNotification as Notification);
      jest
        .spyOn(notificationsRepository, 'save')
        .mockResolvedValue(mockNotification as Notification);
      jest.spyOn(notificationsRepository, 'find').mockResolvedValue([]);
      jest
        .spyOn(notificationsRepository, 'update')
        .mockResolvedValue({ affected: 0 } as any);

      const result = await service.markAsRead('notification-1', 'user-1');

      expect(result).toEqual(mockNotification);
      expect(notificationsRepository.save).toHaveBeenCalledWith({
        ...mockNotification,
        readAt: expect.any(Date),
      });
      expect(notificationsRepository.find).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          message: { id: 'message-1' },
          readAt: expect.any(Object),
        },
        relations: ['message'],
      });
    });

    it('should mark notification and related notifications as read', async () => {
      const relatedNotification = {
        id: 'notification-2',
        userId: 'user-1',
        message: { id: 'message-1' },
        readAt: null,
      };

      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(mockNotification as Notification);
      jest
        .spyOn(notificationsRepository, 'save')
        .mockResolvedValue(mockNotification as Notification);
      jest
        .spyOn(notificationsRepository, 'find')
        .mockResolvedValue([relatedNotification] as any);
      jest
        .spyOn(notificationsRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await service.markAsRead('notification-1', 'user-1');

      expect(result).toEqual(mockNotification);
      expect(notificationsRepository.save).toHaveBeenCalledWith({
        ...mockNotification,
        readAt: expect.any(Date),
      });
      expect(notificationsRepository.find).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          message: { id: 'message-1' },
          readAt: expect.any(Object),
        },
        relations: ['message'],
      });
      expect(notificationsRepository.update).toHaveBeenCalledWith(
        { id: expect.any(Object) },
        { readAt: expect.any(Date) },
      );
    });
  });

  describe('countRelatedUnreadNotifications', () => {
    it('should count related unread notifications', async () => {
      jest.spyOn(notificationsRepository, 'count').mockResolvedValue(2);

      const result = await service.countRelatedUnreadNotifications(
        'message-1',
        'user-1',
      );

      expect(result).toBe(2);
      expect(notificationsRepository.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          message: { id: 'message-1' },
          readAt: expect.any(Object),
        },
        relations: ['message'],
      });
    });

    it('should return 0 when no related unread notifications exist', async () => {
      jest.spyOn(notificationsRepository, 'count').mockResolvedValue(0);

      const result = await service.countRelatedUnreadNotifications(
        'message-1',
        'user-1',
      );

      expect(result).toBe(0);
      expect(notificationsRepository.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          message: { id: 'message-1' },
          readAt: expect.any(Object),
        },
        relations: ['message'],
      });
    });
  });

  describe('markAsUnread', () => {
    it('should mark notification as unread successfully', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(mockNotification as Notification);
      jest
        .spyOn(notificationsRepository, 'save')
        .mockResolvedValue(mockNotification as Notification);

      const result = await service.markAsUnread('notification-1', 'user-1');

      expect(result).toEqual(mockNotification);
      expect(notificationsRepository.save).toHaveBeenCalledWith({
        ...mockNotification,
        readAt: undefined,
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read successfully', async () => {
      jest
        .spyOn(notificationsRepository, 'update')
        .mockResolvedValue({ affected: 5 } as any);

      const result = await service.markAllAsRead('user-1');

      expect(result.updatedCount).toBe(5);
      expect(notificationsRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', readAt: expect.any(Object) },
        { readAt: expect.any(Date) },
      );
    });
  });

  describe('getNotificationServices', () => {
    it('should return PUSH services for all platforms when mode is Onboard and services are initialized', async () => {
      // Configure ServerSettingsService to return 'Onboard' for push modes
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Onboard')
        .mockResolvedValueOnce('Onboard')
        .mockResolvedValueOnce('Onboard');

      // All services are initialized by default in beforeEach
      const result = await service.getNotificationServices();

      expect(result).toHaveLength(3); // iOS, Android, Web
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            devicePlatform: 'IOS',
            service: 'PUSH',
          }),
          expect.objectContaining({
            devicePlatform: 'ANDROID',
            service: 'PUSH',
          }),
          expect.objectContaining({
            devicePlatform: 'WEB',
            service: 'PUSH',
          }),
        ]),
      );
    });

    it('should return LOCAL services when mode is Local', async () => {
      // Configure ServerSettingsService to return 'Local' for all platforms
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Local')
        .mockResolvedValueOnce('Local')
        .mockResolvedValueOnce('Local');

      const result = await service.getNotificationServices();

      expect(result).toHaveLength(3); // iOS, Android, Web
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            devicePlatform: 'IOS',
            service: 'LOCAL',
          }),
          expect.objectContaining({
            devicePlatform: 'ANDROID',
            service: 'LOCAL',
          }),
          expect.objectContaining({
            devicePlatform: 'WEB',
            service: 'LOCAL',
          }),
        ]),
      );
    });

    it('should return empty array when all modes are Off', async () => {
      // Configure ServerSettingsService to return 'Off' for all platforms
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Off')
        .mockResolvedValueOnce('Off')
        .mockResolvedValueOnce('Off');

      const result = await service.getNotificationServices();

      expect(result).toHaveLength(0);
    });

    it('should not return PUSH service for iOS when provider is not initialized', async () => {
      // iOS mode is Onboard but provider not initialized
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Onboard')
        .mockResolvedValueOnce('Local')
        .mockResolvedValueOnce('Local');
      
      mockIOSPushService.provider = null;

      const result = await service.getNotificationServices();

      const iosService = result.find((s) => s.devicePlatform === 'IOS');
      expect(iosService).toBeUndefined();
    });

    it('should not return PUSH service for Android when app is not initialized', async () => {
      // Android mode is Onboard but app not initialized
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Local')
        .mockResolvedValueOnce('Onboard')
        .mockResolvedValueOnce('Local');
      
      mockFirebasePushService.app = null;

      const result = await service.getNotificationServices();

      const androidService = result.find((s) => s.devicePlatform === 'ANDROID');
      expect(androidService).toBeUndefined();
    });

    it('should not return PUSH service for Web when not configured', async () => {
      // Web mode is Onboard but not configured
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Local')
        .mockResolvedValueOnce('Local')
        .mockResolvedValueOnce('Onboard');
      
      mockWebPushService.configured = false;

      const result = await service.getNotificationServices();

      const webService = result.find((s) => s.devicePlatform === 'WEB');
      expect(webService).toBeUndefined();
    });

    it('should return PUSH service for Passthrough mode when service is initialized', async () => {
      // Test Passthrough mode
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Passthrough')
        .mockResolvedValueOnce('Passthrough')
        .mockResolvedValueOnce('Passthrough');

      const result = await service.getNotificationServices();

      expect(result).toHaveLength(3);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            devicePlatform: 'IOS',
            service: 'PUSH',
          }),
          expect.objectContaining({
            devicePlatform: 'ANDROID',
            service: 'PUSH',
          }),
          expect.objectContaining({
            devicePlatform: 'WEB',
            service: 'PUSH',
          }),
        ]),
      );
    });
  });

  describe('sendPrebuilt', () => {
    it('should send iOS prebuilt notification successfully', async () => {
      const iosPayload: ExternalNotifyRequestDto = {
        platform: ExternalPlatform.IOS,
        payload: {
          rawPayload: {
            aps: {
              alert: { title: 'Encrypted Notification' },
              sound: 'default',
              'mutable-content': 1,
              'content-available': 1,
            },
            enc: 'encrypted_data_blob',
          },
          customPayload: { priority: 10 },
          priority: 10,
          topic: 'com.test.app',
        },
        deviceData: {
          token: 'test_device_token_123',
        },
      };

      mockIOSPushService.sendPrebuilt.mockResolvedValue({ success: true });

      const result = await service.sendPrebuilt(iosPayload);

      expect(result).toEqual({ success: true });
      expect(mockIOSPushService.sendPrebuilt).toHaveBeenCalledWith(
        iosPayload.deviceData,
        iosPayload.payload,
      );
    });

    it('should send Android prebuilt notification successfully', async () => {
      const androidPayload: ExternalNotifyRequestDto = {
        platform: ExternalPlatform.ANDROID,
        payload: {
          tokens: ['test_device_token_123'],
          apns: {
            payload: {
              aps: {
                alert: { title: 'Test Notification', body: 'Test Body' },
                sound: 'default',
              },
            },
          },
          data: {
            notificationId: 'test-notification-id',
            actions: JSON.stringify([]),
          },
        },
        deviceData: {
          token: 'test_device_token_123',
        },
      };

      mockFirebasePushService.sendPrebuilt.mockResolvedValue({ success: true });

      const result = await service.sendPrebuilt(androidPayload);

      expect(result).toEqual({ success: true });
      expect(mockFirebasePushService.sendPrebuilt).toHaveBeenCalledWith(
        androidPayload.deviceData,
        androidPayload.payload,
      );
    });

    it('should send Web Push prebuilt notification successfully', async () => {
      const webPayload: ExternalNotifyRequestDto = {
        platform: ExternalPlatform.WEB,
        payload: {
          title: 'Test Web Notification',
          body: 'Test Web Body',
          url: '/',
          notificationId: 'test-notification-id',
          actions: [
            {
              action: 'OPEN',
              title: 'Open',
            },
          ],
        },
        deviceData: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          p256dh: 'test_p256dh_key',
          auth: 'test_auth_secret',
          publicKey: 'test_vapid_public_key',
          privateKey: 'test_vapid_private_key',
        },
      };

      mockWebPushService.sendPrebuilt.mockResolvedValue({ success: true });

      const result = await service.sendPrebuilt(webPayload);

      expect(result).toEqual({ success: true });
      expect(mockWebPushService.sendPrebuilt).toHaveBeenCalledWith(
        webPayload.deviceData,
        webPayload.payload,
      );
    });

    it('should handle iOS notification failure', async () => {
      const iosPayload: ExternalNotifyRequestDto = {
        platform: ExternalPlatform.IOS,
        payload: {
          rawPayload: { aps: { alert: { title: 'Test' } } },
          customPayload: { priority: 10 },
          priority: 10,
          topic: 'com.test.app',
        },
        deviceData: {
          token: 'test_device_token_123',
        },
      };

      mockIOSPushService.sendPrebuilt.mockResolvedValue({ success: false });

      const result = await service.sendPrebuilt(iosPayload);

      expect(result).toEqual({ success: false });
      expect(mockIOSPushService.sendPrebuilt).toHaveBeenCalledWith(
        iosPayload.deviceData,
        iosPayload.payload,
      );
    });

    it('should handle Android notification failure', async () => {
      const androidPayload: ExternalNotifyRequestDto = {
        platform: ExternalPlatform.ANDROID,
        payload: {
          tokens: ['test_device_token_123'],
          apns: { payload: { aps: { alert: { title: 'Test' } } } },
          data: { notificationId: 'test-id' },
        },
        deviceData: {
          token: 'test_device_token_123',
        },
      };

      mockFirebasePushService.sendPrebuilt.mockResolvedValue({
        success: false,
      });

      const result = await service.sendPrebuilt(androidPayload);

      expect(result).toEqual({ success: false });
      expect(mockFirebasePushService.sendPrebuilt).toHaveBeenCalledWith(
        androidPayload.deviceData,
        androidPayload.payload,
      );
    });

    it('should handle Web Push notification failure', async () => {
      const webPayload: ExternalNotifyRequestDto = {
        platform: ExternalPlatform.WEB,
        payload: {
          title: 'Test Web Notification',
          body: 'Test Web Body',
        },
        deviceData: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          p256dh: 'test_p256dh_key',
          auth: 'test_auth_secret',
          publicKey: 'test_vapid_public_key',
          privateKey: 'test_vapid_private_key',
        },
      };

      mockWebPushService.sendPrebuilt.mockResolvedValue({ success: false });

      const result = await service.sendPrebuilt(webPayload);

      expect(result).toEqual({ success: false });
      expect(mockWebPushService.sendPrebuilt).toHaveBeenCalledWith(
        webPayload.deviceData,
        webPayload.payload,
      );
    });

    it('should return error for unsupported platform', async () => {
      const unsupportedPayload = {
        platform: 'UNSUPPORTED' as any,
        payload: { test: 'data' },
        deviceData: { token: 'test_token' },
      };

      const result = await service.sendPrebuilt(unsupportedPayload);

      expect(result).toEqual({
        success: false,
        message: 'Unsupported platform',
      });
    });

    it('should handle iOS service throwing error', async () => {
      const iosPayload: ExternalNotifyRequestDto = {
        platform: ExternalPlatform.IOS,
        payload: {
          rawPayload: { aps: { alert: { title: 'Test' } } },
          customPayload: { priority: 10 },
          priority: 10,
          topic: 'com.test.app',
        },
        deviceData: {
          token: 'test_device_token_123',
        },
      };

      mockIOSPushService.sendPrebuilt.mockRejectedValue(
        new Error('APNs provider not initialized'),
      );

      await expect(service.sendPrebuilt(iosPayload)).rejects.toThrow(
        'APNs provider not initialized',
      );
    });

    it('should handle Android service throwing error', async () => {
      const androidPayload: ExternalNotifyRequestDto = {
        platform: ExternalPlatform.ANDROID,
        payload: {
          tokens: ['test_device_token_123'],
          apns: { payload: { aps: { alert: { title: 'Test' } } } },
          data: { notificationId: 'test-id' },
        },
        deviceData: {
          token: 'test_device_token_123',
        },
      };

      mockFirebasePushService.sendPrebuilt.mockRejectedValue(
        new Error('Firebase not initialized'),
      );

      await expect(service.sendPrebuilt(androidPayload)).rejects.toThrow(
        'Firebase not initialized',
      );
    });

    it('should handle Web Push service throwing error', async () => {
      const webPayload: ExternalNotifyRequestDto = {
        platform: ExternalPlatform.WEB,
        payload: {
          title: 'Test Web Notification',
          body: 'Test Web Body',
        },
        deviceData: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          p256dh: 'test_p256dh_key',
          auth: 'test_auth_secret',
          publicKey: 'test_vapid_public_key',
          privateKey: 'test_vapid_private_key',
        },
      };

      mockWebPushService.sendPrebuilt.mockRejectedValue(
        new Error('Web Push not configured'),
      );

      await expect(service.sendPrebuilt(webPayload)).rejects.toThrow(
        'Web Push not configured',
      );
    });
  });
});
