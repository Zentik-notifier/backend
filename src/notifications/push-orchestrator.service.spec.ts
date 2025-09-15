import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushNotificationOrchestratorService } from './push-orchestrator.service';
import { IOSPushService } from './ios-push.service';
import { FirebasePushService } from './firebase-push.service';
import { WebPushService } from './web-push.service';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { UrlBuilderService } from '../common/services/url-builder.service';
import { BucketsService } from '../buckets/buckets.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { UsersService } from '../users/users.service';
import { UserSettingType } from '../entities/user-setting.entity';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { Message } from '../entities/message.entity';
import { DevicePlatform } from '../users/dto';

// Mock fetch globally
global.fetch = jest.fn();

describe('PushNotificationOrchestratorService', () => {
  let service: PushNotificationOrchestratorService;
  let notificationsRepository: Repository<Notification>;
  let userDevicesRepository: Repository<UserDevice>;
  let iosPushService: IOSPushService;
  let firebasePushService: FirebasePushService;
  let webPushService: WebPushService;
  let entityPermissionService: EntityPermissionService;
  let subscriptionService: GraphQLSubscriptionService;
  let urlBuilderService: UrlBuilderService;
  let bucketsService: BucketsService;
  let configService: ConfigService;

  const mockNotification: Partial<Notification> = {
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
      bucketId: 'bucket-1',
    } as any,
    userDevice: undefined as any, // not needed for push tests
  };

  const mockUserDevice: Partial<UserDevice> = {
    id: 'device-1',
    userId: 'user-1',
    deviceName: 'iPhone',
    platform: DevicePlatform.IOS,
    deviceToken: 'device-token-123',
  };

  const mockMessage: Partial<Message> = {
    id: 'message-1',
    title: 'Test Message',
    bucketId: 'bucket-1',
  };

  const mockRepository = {
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockIOSPushService = {
    send: jest.fn(),
  };

  const mockFirebasePushService = {
    send: jest.fn(),
  };

  const mockWebPushService = {
    send: jest.fn(),
  };

  const mockEntityPermissionService = {
    getBucketAuthorizedUserIds: jest.fn(),
  };

  const mockSubscriptionService = {
    publishNotificationCreated: jest.fn(),
  };

  const mockUrlBuilderService = {
    processNotifications: jest.fn(),
  };

  const mockBucketsService = {
    findUserBucketsByBucketAndUsers: jest.fn(),
    isBucketSnoozed: jest.fn(),
  } as any;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationOrchestratorService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(UserDevice),
          useValue: mockRepository,
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
          provide: EntityPermissionService,
          useValue: mockEntityPermissionService,
        },
        {
          provide: GraphQLSubscriptionService,
          useValue: mockSubscriptionService,
        },
        {
          provide: UrlBuilderService,
          useValue: mockUrlBuilderService,
        },
        {
          provide: BucketsService,
          useValue: mockBucketsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventTrackingService,
          useValue: {
            trackNotification: jest.fn(),
            trackPushPassthrough: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getUserSetting: jest.fn(async (userId: string, type: UserSettingType) => {
              if (type === UserSettingType.UnencryptOnBigPayload) {
                return { valueBool: true } as any;
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PushNotificationOrchestratorService>(
      PushNotificationOrchestratorService,
    );
    userDevicesRepository = module.get<Repository<UserDevice>>(
      getRepositoryToken(UserDevice),
    );
    iosPushService = module.get<IOSPushService>(IOSPushService);
    firebasePushService = module.get<FirebasePushService>(FirebasePushService);
    webPushService = module.get<WebPushService>(WebPushService);
    entityPermissionService = module.get<EntityPermissionService>(
      EntityPermissionService,
    );
    subscriptionService = module.get<GraphQLSubscriptionService>(
      GraphQLSubscriptionService,
    );
    urlBuilderService = module.get<UrlBuilderService>(UrlBuilderService);
  bucketsService = module.get<BucketsService>(BucketsService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPushToSingleDeviceStateless', () => {
    it('should send iOS push notification successfully', async () => {
      mockIOSPushService.send.mockResolvedValue({ success: true });

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      // userBucketsService removed
      expect(mockIOSPushService.send).toHaveBeenCalledWith(mockNotification, [
        mockUserDevice,
      ]);
    });

    it('should send Android push notification successfully', async () => {
      const androidDevice = {
        ...mockUserDevice,
        platform: DevicePlatform.ANDROID,
      };
      mockFirebasePushService.send.mockResolvedValue({
        success: true,
        successCount: 1,
        results: [{ success: true }],
      });

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        androidDevice as UserDevice,
      );

      expect(result.success).toBe(true);
      expect(mockFirebasePushService.send).toHaveBeenCalledWith(
        mockNotification,
        [androidDevice],
      );
    });

    it('should send Web push notification successfully', async () => {
      const webDevice = { ...mockUserDevice, platform: DevicePlatform.WEB };
      mockWebPushService.send.mockResolvedValue({
        success: true,
        results: [{ success: true }],
      });

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        webDevice as UserDevice,
      );

      expect(result.success).toBe(true);
      expect(mockWebPushService.send).toHaveBeenCalledWith(mockNotification, [
        webDevice,
      ]);
    });

    it('should handle iOS push notification failure', async () => {
      mockIOSPushService.send.mockResolvedValue({
        success: false,
        error: 'APNS error',
      });

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('APNS error');
    });

    it('should handle unsupported platform', async () => {
      const unsupportedDevice = {
        ...mockUserDevice,
        platform: 'UNSUPPORTED' as any,
      };

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        unsupportedDevice as UserDevice,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported platform');
    });
  });

  describe('Passthrough Push Notifications', () => {
    beforeEach(() => {
      // Mock environment variables for passthrough
      mockConfigService.get
        .mockReturnValueOnce('true') // PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED
        .mockReturnValueOnce('https://passthrough-server.com') // PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER
        .mockReturnValueOnce('passthrough-token-123'); // PUSH_PASSTHROUGH_TOKEN
    });

    it('should send push notification via passthrough server successfully', async () => {
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse);

      // Use reflection to access private method for testing
      const result = await (service as any).dispatchPush(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://passthrough-server.com/notifications/notify-external',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer passthrough-token-123',
          },
          body: JSON.stringify({
            notification: JSON.stringify(mockNotification),
            userDevice: JSON.stringify(mockUserDevice),
          }),
        },
      );
    });

    it('should handle passthrough server HTTP error', async () => {
      const mockFetchResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Internal Server Error' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse);

      const result = await (service as any).dispatchPush(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal Server Error');
    });

    it('should handle passthrough server network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await (service as any).dispatchPush(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should build correct external payload for passthrough', async () => {
      const payload = (service as any).buildExternalPayload(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(payload).toEqual({
        notification: JSON.stringify(mockNotification),
        userDevice: JSON.stringify(mockUserDevice),
      });
    });
  });
});
