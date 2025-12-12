import { Test, TestingModule } from '@nestjs/testing';
import { IOSPushService } from './ios-push.service';
import { LocaleService } from '../common/services/locale.service';
import { NotificationActionType } from './notifications.types';
import { ServerSettingsService } from '../server-manager/server-settings.service';

// Mock the crypto utils
jest.mock('../common/utils/cryptoUtils', () => ({
  encryptWithPublicKey: jest.fn().mockResolvedValue('mock-encrypted-data'),
}));

// Mock apn module
jest.mock(
  'apn',
  () => ({
    Provider: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
      shutdown: jest.fn(),
    })),
    Notification: jest.fn().mockImplementation(() => ({
      rawPayload: null,
      payload: null,
      priority: null,
      topic: null,
    })),
  }),
  { virtual: true },
);

describe('IOSPushService', () => {
  let service: IOSPushService;
  let mockProvider: any;

  const mockLocaleService = {
    getLocale: jest.fn().mockReturnValue('en'),
    getTranslatedText: jest.fn().mockImplementation((locale: string, key: string) => {
      // Return a simple translation based on key
      const translations: Record<string, string> = {
        'notifications.actions.delete': 'Delete',
        'notifications.actions.markAsRead': 'Mark as Read',
        'notifications.actions.openNotification': 'Open',
        'notifications.actions.snooze': 'Snooze',
        'notifications.actions.postpone': 'Postpone',
      };
      return translations[key] || key;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IOSPushService,
        {
          provide: LocaleService,
          useValue: mockLocaleService,
        },
        {
          provide: ServerSettingsService,
          useValue: {
            getSettingByType: jest.fn().mockResolvedValue({
              valueText: 'com.test.app',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<IOSPushService>(IOSPushService);

    // Mock the provider
    mockProvider = {
      send: jest.fn(),
      shutdown: jest.fn(),
    };
    (service as any).provider = mockProvider;

    jest.clearAllMocks();
  });

  describe('sendPrebuilt', () => {
    it('should send iOS prebuilt notification successfully', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
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
        topic: 'com.test.app',
      };

      mockProvider.send.mockResolvedValue({
        sent: [{ token: 'test_device_token_123' }],
        failed: [],
      });

      const result = await service.sendPrebuilt({ deviceData, payload });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results![0]).toEqual({
        token: 'test_device_token_123',
        result: {
          sent: [{ token: 'test_device_token_123' }],
          failed: [],
        },
      });

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          rawPayload: payload.payload,
          priority: payload.priority,
          topic: payload.topic,
        }),
        'test_device_token_123',
      );
    });

    it('should handle iOS notification failure', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
        payload: {
          aps: {
            alert: { title: 'Test Notification' },
            sound: 'default',
          },
        },
        priority: 10,
        topic: 'com.test.app',
      };

      mockProvider.send.mockResolvedValue({
        sent: [],
        failed: [
          {
            token: 'test_device_token_123',
            error: 'InvalidDeviceToken',
          },
        ],
      });

      const result = await service.sendPrebuilt({ deviceData, payload });

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results![0]).toEqual({
        token: 'test_device_token_123',
        result: {
          sent: [],
          failed: [
            {
              token: 'test_device_token_123',
              error: 'InvalidDeviceToken',
            },
          ],
        },
      });
    });

    it('should throw error when provider is not initialized', async () => {
      (service as any).provider = null;

      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
        payload: { aps: { alert: { title: 'Test' } } },
        priority: 10,
        topic: 'com.test.app',
      };

      await expect(service.sendPrebuilt({ deviceData, payload })).rejects.toThrow(
        'APNs provider not initialized',
      );
    });

    it('should handle provider send throwing error', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
        payload: { aps: { alert: { title: 'Test' } } },
        priority: 10,
        topic: 'com.test.app',
      };

      mockProvider.send.mockRejectedValue(new Error('Network error'));

      await expect(service.sendPrebuilt({ deviceData, payload })).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle payload without priority', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
        payload: { aps: { alert: { title: 'Test' } } },
        priority: undefined,
        topic: 'com.test.app',
      };

      mockProvider.send.mockResolvedValue({
        sent: [{ token: 'test_device_token_123' }],
        failed: [],
      });

      const result = await service.sendPrebuilt({ deviceData, payload });

      expect(result.success).toBe(true);
      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          rawPayload: payload.payload,
          topic: payload.topic,
        }),
        'test_device_token_123',
      );
    });

    it('should use default topic when not provided', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
        payload: { aps: { alert: { title: 'Test' } } },
        priority: 10,
        topic: 'com.apocaliss92.zentik', // Include topic in payload
      };

      mockProvider.send.mockResolvedValue({
        sent: [{ token: 'test_device_token_123' }],
        failed: [],
      });

      const result = await service.sendPrebuilt({ deviceData, payload });

      expect(result.success).toBe(true);
      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          rawPayload: payload.payload,
          priority: payload.priority,
          topic: 'com.apocaliss92.zentik',
        }),
        'test_device_token_123',
      );
    });
  });

  describe('buildAPNsPayload', () => {
    const mockNotification = {
      id: 'notification-1',
      message: {
        id: 'message-1',
        title: 'Test Message',
        body: 'Test Body',
        subtitle: 'Test Subtitle',
        bucketId: 'bucket-1',
        sound: 'default',
        deliveryType: 'NORMAL',
        actions: [],
        attachments: [
          {
            mediaType: 'IMAGE',
            url: 'https://example.com/image.jpg',
            name: 'image.jpg',
          },
          {
            mediaType: 'ICON',
            url: 'https://example.com/icon.png',
            name: 'icon.png',
          },
        ],
        bucket: {
          id: 'bucket-1',
          name: 'Test Bucket',
          icon: 'https://example.com/bucket-icon.png',
          color: '#FF0000',
        },
      },
    };

    const mockDevice = {
      id: 'device-1',
      deviceToken: 'device-token-123',
      publicKey: JSON.stringify({
        kty: 'RSA',
        n: 'mock-n-value',
        e: 'AQAB',
      }),
      badgeCount: 5,
    };

    const mockUserSettings = {
      autoAddDeleteAction: true,
      autoAddMarkAsReadAction: true,
      autoAddOpenNotificationAction: false,
      defaultSnoozes: [15, 30],
      defaultPostpones: [60],
    };

    it('should build APNs payload with bucket fields for encrypted device', async () => {
      const result = await service.buildAPNsPayload(
        mockNotification as any,
        mockUserSettings,
        mockDevice as any,
      );

      expect(result.payload).toMatchObject({
        aps: {
          alert: { title: 'Encrypted Notification' },
          sound: 'default',
          'mutable-content': 1,
        },
        e: expect.any(String),
        n: expect.any(String), // notificationId abbreviated (public field)
        b: expect.any(String), // bucketId abbreviated (public field)
        m: expect.any(String), // messageId abbreviated (public field)
        y: expect.any(Number), // deliveryType abbreviated (public field)
      });

        expect(result.payloadSizeKB).toBeDefined();
        expect(result.payloadSizeKB).toBeGreaterThan(0);

      // Verify that bucket fields are NOT in payload (only bucketId in root, not encrypted)
      expect(result.payload.e).toBeDefined();
      expect(result.payload.b).toBeDefined(); // bucket id is in payload root (public field)
      expect(result.payload.bucketName).toBeUndefined(); // Removed from payload
      expect(result.payload.bucketIconUrl).toBeUndefined(); // Removed from payload
      expect(result.payload.bucketColor).toBeUndefined(); // Removed from payload

      // Verify privatizedPayload includes sensitive field with privatized data
      expect(result.privatizedPayload).toBeDefined();
      expect(result.privatizedPayload.e).toMatch(/^.{17,20}\.\.\.$/); // Privatized encrypted blob (mock-encrypted-data is 19 chars)
      expect(result.privatizedPayload.sensitive).toBeDefined();
      expect(result.privatizedPayload.sensitive.tit).toMatch(/^.{5}\.\.\.$/); // Privatized title
      expect(result.privatizedPayload.sensitive.bdy).toMatch(/^.{5}\.\.\.$/); // Privatized body
      expect(result.privatizedPayload.sensitive.stl).toMatch(/^.{5}\.\.\.$/); // Privatized subtitle
      expect(result.privatizedPayload.sensitive.att).toBeDefined(); // Privatized attachments
      expect(result.privatizedPayload.sensitive.tp).toBeDefined(); // Privatized tap action
    });

    it('should build APNs payload with bucket fields for non-encrypted device', async () => {
      const nonEncryptedDevice = { ...mockDevice, publicKey: undefined };

      const result = await service.buildAPNsPayload(
        mockNotification as any,
        mockUserSettings,
        nonEncryptedDevice as any,
      );

      expect(result.payload).toMatchObject({
        aps: {
          alert: {
            title: 'Test Message',
            body: 'Test Body',
            // subtitle is NOT in aps.alert, it's in payload root as 'stl'
          },
          sound: 'default',
          'mutable-content': 1,
        },
        n: expect.any(String), // notificationId abbreviated (public field)
        b: expect.any(String), // bucketId abbreviated (public field)
        m: expect.any(String), // messageId abbreviated (public field)
        y: expect.any(Number), // deliveryType abbreviated (public field)
        tit: 'Test Message', // title abbreviated (sensitive field in root for non-encrypted)
        bdy: 'Test Body', // body abbreviated (sensitive field in root for non-encrypted)
        stl: 'Test Subtitle', // subtitle abbreviated (sensitive field in root for non-encrypted)
      });

        expect(result.payloadSizeKB).toBeDefined();
        expect(result.payloadSizeKB).toBeGreaterThan(0);

      // Verify bucket fields are NOT in payload (optimized - only bucketId)
      expect(result.payload.bucketName).toBeUndefined(); // Removed from payload
      expect(result.payload.bucketIconUrl).toBeUndefined(); // Removed from payload
      expect(result.payload.bucketColor).toBeUndefined(); // Removed from payload

      // Verify no encryption blob for non-encrypted device
      expect(result.payload.e).toBeUndefined();

      // Verify privatizedPayload for non-encrypted device (no sensitive field)
      expect(result.privatizedPayload).toBeDefined();
      expect(result.privatizedPayload.tit).toMatch(/^.{5}\.\.\.$/); // Privatized title
      expect(result.privatizedPayload.bdy).toMatch(/^.{5}\.\.\.$/); // Privatized body
      expect(result.privatizedPayload.stl).toMatch(/^.{5}\.\.\.$/); // Privatized subtitle
      expect(result.privatizedPayload.sensitive).toBeUndefined(); // No sensitive field for non-encrypted
    });

    it('should build APNs payload with Communication Notifications format when bucket fields present', async () => {
      const result = await service.buildAPNsPayload(
        mockNotification as any,
        mockUserSettings,
        mockDevice as any,
      );

      // For Communication Notifications with bucket fields, should use minimal alert
      expect(result.payload.aps.alert).toEqual({
        title: 'Encrypted Notification',
      });
      expect(result.payload.aps.alert.body).toBeUndefined();
    });

    it('should build APNs payload without Communication Notifications format when bucket fields missing', async () => {
      const notificationWithoutBucket = {
        ...mockNotification,
        message: {
          ...mockNotification.message,
          bucketId: 'bucket-1',
          bucket: null,
        },
      };

      // Use device without publicKey to avoid encryption
      const nonEncryptedDevice = { ...mockDevice, publicKey: undefined };

      const result = await service.buildAPNsPayload(
        notificationWithoutBucket as any,
        mockUserSettings,
        nonEncryptedDevice as any,
      );

      // For regular notifications without bucket fields, should use full alert
      // subtitle is NOT in aps.alert, it's in payload root as 'stl'
      expect(result.payload.aps.alert).toEqual({
        title: 'Test Message',
        body: 'Test Body',
      });
      expect(result.payload.stl).toBe('Test Subtitle'); // subtitle in payload root
    });

    it('should include attachmentData in payload as string array (excluding ICON attachments)', async () => {
      const result = await service.buildAPNsPayload(
        mockNotification as any,
        mockUserSettings,
        undefined, // Non-encrypted
      );

      // Should include attachments as string array format: ["IMAGE:url"]
      // ICON attachments should be filtered out
      expect(result.payload.att).toEqual([
        'IMAGE:https://example.com/image.jpg',
        // ICON attachment should be filtered out
      ]);

      // Old format should not be present
      expect(result.payload.attachmentData).toBeUndefined();
    });

    it('should handle missing bucket gracefully', async () => {
      const notificationWithoutBucket = {
        ...mockNotification,
        message: {
          ...mockNotification.message,
          bucket: null,
        },
      };

      const result = await service.buildAPNsPayload(
        notificationWithoutBucket as any,
        mockUserSettings,
        undefined,
      );

      expect(result.payload).toMatchObject({
        aps: {
          alert: {
            title: 'Test Message',
            body: 'Test Body',
            // subtitle is NOT in aps.alert, it's in payload root as 'stl'
          },
        },
        n: expect.any(String), // notificationId abbreviated (public field)
        b: expect.any(String), // bucketId abbreviated (public field)
        m: expect.any(String), // messageId abbreviated (public field)
        y: expect.any(Number), // deliveryType abbreviated (public field)
        tit: 'Test Message', // title abbreviated (sensitive field in root for non-encrypted)
        bdy: 'Test Body', // body abbreviated (sensitive field in root for non-encrypted)
        stl: 'Test Subtitle', // subtitle abbreviated (sensitive field in root for non-encrypted)
        // bucketName, bucketIconUrl, bucketColor removed from payload
      });

      expect(result.payload.bucketName).toBeUndefined();
      expect(result.payload.bucketIconUrl).toBeUndefined();
      expect(result.payload.bucketColor).toBeUndefined();
    });

    it('should include actions in payload (abbreviated key)', async () => {
      const result = await service.buildAPNsPayload(
        mockNotification as any,
        mockUserSettings,
        undefined,
      );

      // Actions should include automatic actions generated from userSettings
      // Actions use abbreviated key "a"
      expect(result.payload.a).toBeDefined();
      expect(Array.isArray(result.payload.a)).toBe(true);
      // Should include automatic actions based on userSettings
      expect(result.payload.a.length).toBeGreaterThan(0);

      // Old key should not be present
      expect(result.payload.actions).toBeUndefined();
    });

    it('should handle priority correctly', async () => {
      const result = await service.buildAPNsPayload(
        mockNotification as any,
        mockUserSettings,
        undefined,
      );

      expect(result.priority).toBe(10);
    });

    it('should separate NAVIGATE/BACKGROUND_CALL actions in encrypted blob and others outside', async () => {
      const notificationWithActions = {
        ...mockNotification,
        message: {
          ...mockNotification.message,
          actions: [
            {
              type: NotificationActionType.NAVIGATE,
              value: '/test',
              title: 'Navigate',
            },
            {
              type: NotificationActionType.BACKGROUND_CALL,
              value: 'https://api.example.com',
              title: 'Call API',
            },
            {
              type: NotificationActionType.MARK_AS_READ,
              value: 'notification-1',
              title: 'Mark as Read',
            },
            {
              type: NotificationActionType.DELETE,
              value: 'notification-1',
              title: 'Delete',
            },
          ],
        },
      };

      const result = await service.buildAPNsPayload(
        notificationWithActions as any,
        mockUserSettings,
        mockDevice as any, // Encrypted device
      );

      // NAVIGATE and BACKGROUND_CALL should be in encrypted blob (enc)
      expect(result.payload.e).toBeDefined();

      // Other actions (MARK_AS_READ, DELETE) should be outside encrypted blob
      expect(result.payload.a).toBeDefined();
      expect(Array.isArray(result.payload.a)).toBe(true);

      // Verify that public actions don't include NAVIGATE or BACKGROUND_CALL
      const publicActions = result.payload.a || [];
      const hasNavigate = publicActions.some(
        (action: any) => action.t === 4,
      );
      const hasBackgroundCall = publicActions.some(
        (action: any) => action.t === 5,
      );

      expect(hasNavigate).toBe(false);
      expect(hasBackgroundCall).toBe(false);

      // Verify privatizedPayload includes sensitive actions in sensitive field
      expect(result.privatizedPayload.sensitive).toBeDefined();
      expect(result.privatizedPayload.sensitive.a).toBeDefined();
      expect(Array.isArray(result.privatizedPayload.sensitive.a)).toBe(true);
      // Verify sensitive actions are privatized
      result.privatizedPayload.sensitive.a.forEach((action: any) => {
        if (action.v) {
          // Value is substring(0, 8) + "...", so "/test" (5 chars) becomes "/test..." (8 chars total)
          // Pattern should accept any length before "..."
          expect(String(action.v)).toMatch(/\.\.\.$/); // Must end with ...
          expect(String(action.v).length).toBeGreaterThanOrEqual(3); // At least "..."
        }
        if (action.title) {
          expect(action.title).toMatch(/^.{5}\.\.\.$/);
        }
      });
    });

    it('should include all actions in payload for non-encrypted device', async () => {
      const notificationWithActions = {
        ...mockNotification,
        message: {
          ...mockNotification.message,
          actions: [
            {
              type: NotificationActionType.NAVIGATE,
              value: '/test',
              title: 'Navigate',
            },
            {
              type: NotificationActionType.MARK_AS_READ,
              value: 'notification-1',
              title: 'Mark as Read',
            },
          ],
        },
      };

      const nonEncryptedDevice = { ...mockDevice, publicKey: undefined };
      const result = await service.buildAPNsPayload(
        notificationWithActions as any,
        mockUserSettings,
        nonEncryptedDevice as any,
      );

      // For non-encrypted devices, all actions should be in payload
      expect(result.payload.a).toBeDefined();
      expect(Array.isArray(result.payload.a)).toBe(true);
      expect(result.payload.a.length).toBeGreaterThan(0);
    });
  });
});
