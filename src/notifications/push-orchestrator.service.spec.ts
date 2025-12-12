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
import { LocaleService } from '../common/services/locale.service';
import { BucketsService } from '../buckets/buckets.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { EntityExecutionService } from '../entity-execution/entity-execution.service';
import { UsersService } from '../users/users.service';
import { UserSettingType } from '../entities/user-setting.types';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { Message } from '../entities/message.entity';
import { DevicePlatform } from '../users/dto';
import { ServerSettingsService } from '../server-manager/server-settings.service';

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
    buildAPNsPayload: jest.fn(),
  };

  const mockFirebasePushService = {
    send: jest.fn(),
    buildFirebaseMessage: jest.fn(),
  };

  const mockWebPushService = {
    send: jest.fn(),
    buildWebPayload: jest.fn(),
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

  const mockServerSettingsService = {
    getSettingByType: jest.fn().mockImplementation(async (configType?: any) => {
      // Return bundle id when requested
      if (
        configType &&
        (configType === (require('../entities/server-setting.entity').ServerSettingType?.ApnBundleId) ||
          String(configType).includes('ApnBundleId'))
      ) {
        return { valueText: 'com.apocaliss92.zentik' };
      }
      return { valueNumber: 1000 };
    }),
    getStringValue: jest.fn().mockResolvedValue('Off'),
    getBoolValue: jest.fn().mockResolvedValue(false),
    getNumberValue: jest.fn().mockResolvedValue(1000),
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
            trackNotificationFailed: jest.fn(),
            trackPushPassthrough: jest.fn(),
          },
        },
        {
          provide: EntityExecutionService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'execution-1' }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getUserSetting: jest.fn(
              async (userId: string, type: UserSettingType) => {
                if (type === UserSettingType.UnencryptOnBigPayload) {
                  return { valueBool: true } as any;
                }
                return null;
              },
            ),
            getMultipleUserSettings: jest.fn().mockResolvedValue(
              new Map([
                [UserSettingType.AutoAddDeleteAction, { valueBool: true }],
                [UserSettingType.AutoAddMarkAsReadAction, { valueBool: true }],
                [UserSettingType.AutoAddOpenNotificationAction, { valueBool: false }],
                [UserSettingType.DefaultSnoozes, null],
                [UserSettingType.DefaultPostpones, null],
              ]),
            ),
          },
        },
        {
          provide: ServerSettingsService,
          useValue: mockServerSettingsService,
        },
        {
          provide: LocaleService,
          useValue: {
            getTranslatedText: jest.fn().mockReturnValue('[Reminder]'),
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

  describe('Passthrough retry behaviour', () => {
    it('should forward retryWithoutEncEnabled=true to passthrough server and ios meta', async () => {
      const iosDevice: UserDevice = {
        ...(mockUserDevice as UserDevice),
      };

      const usersService = (service as any).usersService;
      (usersService.getUserSetting as jest.Mock).mockResolvedValueOnce({
        valueBool: true,
      });

      // Ensure external payload building succeeds for iOS passthrough
      mockIOSPushService.buildAPNsPayload.mockResolvedValue({
        payload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data',
        },
        priority: 10,
        topic: 'com.apocaliss92.zentik',
        privatizedPayload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data...',
          sensitive: { tit: 'Test...', bdy: 'Test...' },
        },
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: jest.fn().mockReturnValue(null) },
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await (service as any).sendViaPassthrough(
        'https://passthrough.test',
        'sat-token',
        mockNotification as Notification,
        iosDevice,
        false,
      );

      expect(result).toEqual({ success: true });

      // Request body must contain retryWithoutEncEnabled=true
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.retryWithoutEncEnabled).toBe(true);

      // iosMeta passed to event tracking should reflect the same flag
      const eventTracking = (service as any).eventTrackingService;
      const trackNotificationCalls =
        (eventTracking.trackNotification as jest.Mock).mock.calls;
      expect(trackNotificationCalls.length).toBeGreaterThan(0);
      const iosMeta = trackNotificationCalls[0][4];
      expect(iosMeta).toBeDefined();
      expect(iosMeta.retryWithoutEncEnabled).toBe(true);
    });

    it('should forward retryWithoutEncEnabled=false when user setting is disabled', async () => {
      const iosDevice: UserDevice = {
        ...(mockUserDevice as UserDevice),
      };

      const usersService = (service as any).usersService;
      (usersService.getUserSetting as jest.Mock).mockResolvedValueOnce({
        valueBool: false,
      });

      // Ensure external payload building succeeds for iOS passthrough
      mockIOSPushService.buildAPNsPayload.mockResolvedValue({
        payload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data',
        },
        priority: 10,
        topic: 'com.apocaliss92.zentik',
        privatizedPayload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data...',
          sensitive: { tit: 'Test...', bdy: 'Test...' },
        },
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: jest.fn().mockReturnValue(null) },
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await (service as any).sendViaPassthrough(
        'https://passthrough.test',
        'sat-token',
        mockNotification as Notification,
        iosDevice,
        false,
      );

      expect(result).toEqual({ success: true });

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.retryWithoutEncEnabled).toBe(false);

      const eventTracking = (service as any).eventTrackingService;
      const iosMeta = (eventTracking.trackNotification as jest.Mock).mock.calls[0][4];
      expect(iosMeta).toBeDefined();
      expect(iosMeta.retryWithoutEncEnabled).toBe(false);
    });
  });

  describe('User Settings Integration', () => {
    it('should pass user settings to iOS push service', async () => {
      const mockUsersService = {
        getMultipleUserSettings: jest.fn().mockResolvedValue(
          new Map([
            [UserSettingType.AutoAddDeleteAction, { valueBool: false }],
            [UserSettingType.AutoAddMarkAsReadAction, { valueBool: true }],
            [UserSettingType.AutoAddOpenNotificationAction, { valueBool: false }],
          ]),
        ),
      };

      // Replace UsersService mock for this test
      (service as any).usersService = mockUsersService;

      mockIOSPushService.send.mockResolvedValue({ 
        success: true,
        privatizedPayload: {
          aps: { alert: { title: 'Test...' } },
          nid: 'notification-1',
          bid: 'bucket-1',
        },
      });

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(result.success).toBe(true);
      expect(mockUsersService.getMultipleUserSettings).toHaveBeenCalledWith(
        'user-1',
        [
          UserSettingType.AutoAddDeleteAction,
          UserSettingType.AutoAddMarkAsReadAction,
          UserSettingType.AutoAddOpenNotificationAction,
          UserSettingType.DefaultSnoozes,
          UserSettingType.DefaultPostpones,
        ],
        'device-1',
      );
      expect(mockIOSPushService.send).toHaveBeenCalledWith(
        mockNotification,
        [mockUserDevice],
        {
          autoAddDeleteAction: false,
          autoAddMarkAsReadAction: true,
          autoAddOpenNotificationAction: false,
          defaultSnoozes: undefined,
          defaultPostpones: undefined,
        },
        { allowUnencryptedRetryOnPayloadTooLarge: false },
      );
    });

    it('should use provided user settings if available', async () => {
      const userSettings = {
        autoAddDeleteAction: false,
        autoAddMarkAsReadAction: false,
        autoAddOpenNotificationAction: true,
      };

      mockIOSPushService.send.mockResolvedValue({ 
        success: true,
        privatizedPayload: {
          aps: { alert: { title: 'Test...' } },
          nid: 'notification-1',
          bid: 'bucket-1',
        },
      });

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
        userSettings,
      );

      expect(result.success).toBe(true);
      expect(mockIOSPushService.send).toHaveBeenCalledWith(
        mockNotification,
        [mockUserDevice],
        userSettings,
        { allowUnencryptedRetryOnPayloadTooLarge: true },
      );
    });

    it('should default to true for DELETE and MARK_AS_READ, false for OPEN when user settings are not found', async () => {
      const mockUsersService = {
        getMultipleUserSettings: jest.fn().mockResolvedValue(
          new Map([
            [UserSettingType.AutoAddDeleteAction, null],
            [UserSettingType.AutoAddMarkAsReadAction, null],
            [UserSettingType.AutoAddOpenNotificationAction, null],
          ]),
        ),
      };

      (service as any).usersService = mockUsersService;

      mockIOSPushService.send.mockResolvedValue({ 
        success: true,
        privatizedPayload: {
          aps: { alert: { title: 'Test...' } },
          nid: 'notification-1',
          bid: 'bucket-1',
        },
      });

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(result.success).toBe(true);
      expect(mockIOSPushService.send).toHaveBeenCalledWith(
        mockNotification,
        [mockUserDevice],
        {
          autoAddDeleteAction: true,
          autoAddMarkAsReadAction: true,
          autoAddOpenNotificationAction: false,
        },
        { allowUnencryptedRetryOnPayloadTooLarge: false },
      );
    });

    it('should pass user settings to Android push service', async () => {
      const androidDevice = {
        ...mockUserDevice,
        platform: DevicePlatform.ANDROID,
      };

      const userSettings = {
        autoAddDeleteAction: true,
        autoAddMarkAsReadAction: false,
        autoAddOpenNotificationAction: true,
      };

      mockFirebasePushService.send.mockResolvedValue({
        success: true,
        successCount: 1,
        results: [{ success: true }],
      });

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        androidDevice as UserDevice,
        userSettings,
      );

      expect(result.success).toBe(true);
      expect(mockFirebasePushService.send).toHaveBeenCalledWith(
        mockNotification,
        [androidDevice],
        userSettings,
      );
    });

    it('should pass user settings to Web push service', async () => {
      const webDevice = {
        ...mockUserDevice,
        platform: DevicePlatform.WEB,
      };

      const userSettings = {
        autoAddDeleteAction: false,
        autoAddMarkAsReadAction: false,
        autoAddOpenNotificationAction: false,
      };

      mockWebPushService.send.mockResolvedValue({
        success: true,
        results: [{ success: true }],
        privatizedPayload: {
          title: 'Test...',
          body: 'Test...',
          notificationId: 'notification-1',
        },
      });

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        webDevice as UserDevice,
        userSettings,
      );

      expect(result.success).toBe(true);
      expect(mockWebPushService.send).toHaveBeenCalledWith(
        mockNotification,
        [webDevice],
        userSettings,
      );
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPushToSingleDeviceStateless', () => {
    it('should send iOS push notification successfully', async () => {
      mockIOSPushService.send.mockResolvedValue({ 
        success: true,
        privatizedPayload: {
          aps: { alert: { title: 'Test...' } },
          nid: 'notification-1',
          bid: 'bucket-1',
        },
      });

      const userSettings = {
        autoAddDeleteAction: true,
        autoAddMarkAsReadAction: true,
        autoAddOpenNotificationAction: true,
      };

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
        userSettings,
      );

      expect(result.success).toBe(true);
      expect(mockIOSPushService.send).toHaveBeenCalledWith(
        mockNotification,
        [mockUserDevice],
        userSettings,
        { allowUnencryptedRetryOnPayloadTooLarge: true },
      );
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

      const userSettings = {
        autoAddDeleteAction: true,
        autoAddMarkAsReadAction: true,
        autoAddOpenNotificationAction: true,
      };

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        androidDevice as UserDevice,
        userSettings,
      );

      expect(result.success).toBe(true);
      expect(mockFirebasePushService.send).toHaveBeenCalledWith(
        mockNotification,
        [androidDevice],
        userSettings,
      );
    });

    it('should send Web push notification successfully', async () => {
      const webDevice = { ...mockUserDevice, platform: DevicePlatform.WEB };
      mockWebPushService.send.mockResolvedValue({
        success: true,
        results: [{ success: true }],
        privatizedPayload: {
          title: 'Test...',
          body: 'Test...',
          notificationId: 'notification-1',
        },
      });

      const userSettings = {
        autoAddDeleteAction: true,
        autoAddMarkAsReadAction: true,
        autoAddOpenNotificationAction: true,
      };

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        webDevice as UserDevice,
        userSettings,
      );

      expect(result.success).toBe(true);
      expect(mockWebPushService.send).toHaveBeenCalledWith(
        mockNotification,
        [webDevice],
        userSettings,
      );
    });

    it('should handle iOS push notification failure', async () => {
      mockIOSPushService.send.mockResolvedValue({
        success: false,
        error: 'APNS error',
      });

      const userSettings = {
        autoAddDeleteAction: true,
        autoAddMarkAsReadAction: true,
        autoAddOpenNotificationAction: true,
      };

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
        userSettings,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('APNS error');
    });

    it('should handle unsupported platform', async () => {
      const unsupportedDevice = {
        ...mockUserDevice,
        platform: 'UNSUPPORTED' as any,
      };

      const userSettings = {
        autoAddDeleteAction: true,
        autoAddMarkAsReadAction: true,
        autoAddOpenNotificationAction: true,
      };

      const result = await service.sendPushToSingleDeviceStateless(
        mockNotification as Notification,
        unsupportedDevice as UserDevice,
        userSettings,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported platform');
    });
  });

  describe('Passthrough Push Notifications', () => {
    it('should send push notification via passthrough server successfully', async () => {
      // Configure ServerSettingsService mock for this test
      // First call will be for IOSPush mode, second for server, third for token
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Passthrough')  // IOSPush mode
        .mockResolvedValueOnce('https://passthrough-server.com')  // Server URL
        .mockResolvedValueOnce('passthrough-token-123');  // Token

      // Mock getMultipleUserSettings for this test
      const mockUsersService = (service as any).usersService;
      mockUsersService.getMultipleUserSettings.mockResolvedValue(
        new Map([
          [UserSettingType.AutoAddDeleteAction, { valueBool: true }],
          [UserSettingType.AutoAddMarkAsReadAction, { valueBool: true }],
          [UserSettingType.AutoAddOpenNotificationAction, { valueBool: false }],
          [UserSettingType.DefaultSnoozes, null],
          [UserSettingType.DefaultPostpones, null],
        ]),
      );

      // Mock buildAPNsPayload to return valid data
      mockIOSPushService.buildAPNsPayload.mockResolvedValue({
        payload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data',
        },
        priority: 10,
        topic: 'com.apocaliss92.zentik',
        privatizedPayload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data...',
          sensitive: { tit: 'Test...', bdy: 'Test...' },
        },
      });

      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
        headers: { get: jest.fn().mockReturnValue(null) },
      } as any;
      (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse);

      // Use reflection to access private method for testing
      const result = await (service as any).dispatchPush(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://passthrough-server.com/notifications/notify-external',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer passthrough-token-123',
          }),
          body: expect.any(String),
        }),
      );
    });

    it('should handle passthrough server HTTP error', async () => {
      // Configure ServerSettingsService mock for this test
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Passthrough')  // IOSPush mode
        .mockResolvedValueOnce('https://passthrough-server.com')  // Server URL
        .mockResolvedValueOnce('passthrough-token-123');  // Token

      // Mock getMultipleUserSettings for this test
      const mockUsersService = (service as any).usersService;
      mockUsersService.getMultipleUserSettings.mockResolvedValue(
        new Map([
          [UserSettingType.AutoAddDeleteAction, { valueBool: true }],
          [UserSettingType.AutoAddMarkAsReadAction, { valueBool: true }],
          [UserSettingType.AutoAddOpenNotificationAction, { valueBool: false }],
          [UserSettingType.DefaultSnoozes, null],
          [UserSettingType.DefaultPostpones, null],
        ]),
      );

      // Mock buildAPNsPayload to return valid data
      mockIOSPushService.buildAPNsPayload.mockResolvedValue({
        payload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data',
        },
        priority: 10,
        topic: 'com.apocaliss92.zentik',
        privatizedPayload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data...',
          sensitive: { tit: 'Test...', bdy: 'Test...' },
        },
      });

      const mockFetchResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Internal Server Error' }),
        headers: { get: jest.fn().mockReturnValue('application/json') },
      } as any;
      (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse);

      const result = await (service as any).dispatchPush(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal Server Error');
    });

    it('should handle passthrough server network error', async () => {
      // Configure ServerSettingsService mock for this test
      mockServerSettingsService.getStringValue
        .mockResolvedValueOnce('Passthrough')  // IOSPush mode
        .mockResolvedValueOnce('https://passthrough-server.com')  // Server URL
        .mockResolvedValueOnce('passthrough-token-123');  // Token

      // Mock getMultipleUserSettings for this test
      const mockUsersService = (service as any).usersService;
      mockUsersService.getMultipleUserSettings.mockResolvedValue(
        new Map([
          [UserSettingType.AutoAddDeleteAction, { valueBool: true }],
          [UserSettingType.AutoAddMarkAsReadAction, { valueBool: true }],
          [UserSettingType.AutoAddOpenNotificationAction, { valueBool: false }],
          [UserSettingType.DefaultSnoozes, null],
          [UserSettingType.DefaultPostpones, null],
        ]),
      );

      // Mock buildAPNsPayload to return valid data
      mockIOSPushService.buildAPNsPayload.mockResolvedValue({
        payload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data',
        },
        priority: 10,
        topic: 'com.apocaliss92.zentik',
        privatizedPayload: {
          aps: { alert: { title: 'Test' } },
          enc: 'encrypted_data...',
          sensitive: { tit: 'Test...', bdy: 'Test...' },
        },
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await (service as any).dispatchPush(
        mockNotification as Notification,
        mockUserDevice as UserDevice,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should build correct external payload for iOS passthrough', async () => {
      const iosDevice = {
        ...mockUserDevice,
        platform: DevicePlatform.IOS,
        deviceToken: 'test_ios_token',
        publicKey: JSON.stringify({
          key_ops: ['encrypt'],
          ext: true,
          kty: 'RSA',
          n: 'test_public_key_n',
          e: 'AQAB',
          alg: 'RSA-OAEP-256',
        }),
      };

      mockIOSPushService.buildAPNsPayload.mockResolvedValue({
        payload: {
          aps: {
            alert: { title: 'Encrypted Notification' },
            sound: 'default',
            'mutable-content': 1,
            'content-available': 1,
          },
          enc: 'encrypted_data_blob',
        },
        priority: 10,
        topic: 'com.apocaliss92.zentik',
        privatizedPayload: {
          aps: {
            alert: { title: 'Encrypted Notification' },
            sound: 'default',
            'mutable-content': 1,
            'content-available': 1,
          },
          enc: 'encrypted_data_blob...',
          nid: 'notification-1',
          bid: 'bucket-1',
          mid: 'message-1',
          dty: 'NORMAL',
          sensitive: {
            tit: 'Test...',
            bdy: 'Test...',
            stl: 'Test...',
            att: ['IMAGE:https://...'],
            tap: { type: 'OPEN_NOTIFICATION', value: 'notif...' },
          },
        },
      });

      const payload = await (service as any).buildExternalPayload(
        mockNotification as Notification,
        iosDevice as UserDevice,
      );

      expect(payload).toEqual({
        platform: DevicePlatform.IOS,
        privatizedPayload: {
          aps: {
            alert: { title: 'Encrypted Notification' },
            sound: 'default',
            'mutable-content': 1,
            'content-available': 1,
          },
          enc: 'encrypted_data_blob...',
          nid: 'notification-1',
          bid: 'bucket-1',
          mid: 'message-1',
          dty: 'NORMAL',
          sensitive: {
            tit: 'Test...',
            bdy: 'Test...',
            stl: 'Test...',
            att: ['IMAGE:https://...'],
            tap: { type: 'OPEN_NOTIFICATION', value: 'notif...' },
          },
        },
        payload: {
          payload: {
            aps: {
              alert: { title: 'Encrypted Notification' },
              sound: 'default',
              'mutable-content': 1,
              'content-available': 1,
            },
            enc: 'encrypted_data_blob',
          },
          priority: 10,
          topic: 'com.apocaliss92.zentik',
        },
        deviceData: {
          token: 'test_ios_token',
        },
      });

      expect(mockIOSPushService.buildAPNsPayload).toHaveBeenCalledWith(
        mockNotification,
        expect.any(Object), // userSettings
        iosDevice,
      );
    });

    it('should build correct external payload for Android passthrough', async () => {
      const androidDevice = {
        ...mockUserDevice,
        platform: DevicePlatform.ANDROID,
        deviceToken: 'test_android_token',
        userId: 'user-1',
        id: 'device-1',
      };

      // Mock getMultipleUserSettings for this test
      const mockUsersService = (service as any).usersService;
      mockUsersService.getMultipleUserSettings.mockResolvedValue(
        new Map([
          [UserSettingType.AutoAddDeleteAction, { valueBool: true }],
          [UserSettingType.AutoAddMarkAsReadAction, { valueBool: true }],
          [UserSettingType.AutoAddOpenNotificationAction, { valueBool: false }],
          [UserSettingType.DefaultSnoozes, null],
          [UserSettingType.DefaultPostpones, null],
        ]),
      );

      mockFirebasePushService.buildFirebaseMessage.mockResolvedValue({
        message: {
          tokens: ['test_android_token'],
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
        privatizedPayload: {
          tokens: ['test_android_token'],
          apns: {
            payload: {
              aps: {
                alert: { title: 'Test...', body: 'Test...' },
                sound: 'default',
              },
            },
          },
          data: {
            notificationId: 'test-notification-id',
            actions: JSON.stringify([]),
          },
        },
      });

      const payload = await (service as any).buildExternalPayload(
        mockNotification as Notification,
        androidDevice as UserDevice,
      );

      expect(payload).toEqual({
        platform: DevicePlatform.ANDROID,
        privatizedPayload: {
          tokens: ['test_android_token'],
          apns: {
            payload: {
              aps: {
                alert: { title: 'Test...', body: 'Test...' },
                sound: 'default',
              },
            },
          },
          data: {
            notificationId: 'test-notification-id',
            actions: JSON.stringify([]),
          },
        },
        payload: {
          tokens: ['test_android_token'],
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
          token: 'test_android_token',
        },
      });

      expect(mockFirebasePushService.buildFirebaseMessage).toHaveBeenCalledWith(
        mockNotification,
        ['test_android_token'],
        expect.any(Object), // userSettings
      );
    });

    it('should build correct external payload for Web passthrough', async () => {
      const webDevice = {
        ...mockUserDevice,
        platform: DevicePlatform.WEB,
        deviceToken: 'test_web_token',
        userId: 'user-1',
        id: 'device-1',
        subscriptionFields: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          p256dh: 'test_p256dh_key',
          auth: 'test_auth_secret',
        },
        publicKey: 'test_vapid_public_key',
        privateKey: 'test_vapid_private_key',
      };

      // Mock getMultipleUserSettings for this test
      const mockUsersService = (service as any).usersService;
      mockUsersService.getMultipleUserSettings.mockResolvedValue(
        new Map([
          [UserSettingType.AutoAddDeleteAction, { valueBool: true }],
          [UserSettingType.AutoAddMarkAsReadAction, { valueBool: true }],
          [UserSettingType.AutoAddOpenNotificationAction, { valueBool: false }],
          [UserSettingType.DefaultSnoozes, null],
          [UserSettingType.DefaultPostpones, null],
        ]),
      );

      mockWebPushService.buildWebPayload.mockReturnValue({
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
        privatizedPayload: {
          title: 'Test...',
          body: 'Test...',
          url: '/',
          notificationId: 'test-notification-id',
          actions: [
            {
              action: 'OPEN',
              title: 'Open',
            },
          ],
        },
      });

      const payload = await (service as any).buildExternalPayload(
        mockNotification as Notification,
        webDevice as UserDevice,
      );

      expect(payload).toEqual({
        platform: DevicePlatform.WEB,
        privatizedPayload: {
          title: 'Test...',
          body: 'Test...',
          url: '/',
          notificationId: 'test-notification-id',
          actions: [
            {
              action: 'OPEN',
              title: 'Open',
            },
          ],
        },
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
      });

      expect(mockWebPushService.buildWebPayload).toHaveBeenCalledWith(
        mockNotification,
        expect.any(Object), // userSettings
      );
    });
  });
});
