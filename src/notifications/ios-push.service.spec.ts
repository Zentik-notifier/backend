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
      };

      mockProvider.send.mockResolvedValue({
        sent: [{ token: 'test_device_token_123' }],
        failed: [],
      });

      const result = await service.sendPrebuilt(deviceData, payload);

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
          rawPayload: payload.rawPayload,
          payload: payload.customPayload,
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
        rawPayload: {
          aps: {
            alert: { title: 'Test Notification' },
            sound: 'default',
          },
        },
        customPayload: { priority: 10 },
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

      const result = await service.sendPrebuilt(deviceData, payload);

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
        rawPayload: { aps: { alert: { title: 'Test' } } },
        customPayload: { priority: 10 },
        priority: 10,
        topic: 'com.test.app',
      };

      await expect(service.sendPrebuilt(deviceData, payload)).rejects.toThrow(
        'APNs provider not initialized',
      );
    });

    it('should handle provider send throwing error', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
        rawPayload: { aps: { alert: { title: 'Test' } } },
        customPayload: { priority: 10 },
        priority: 10,
        topic: 'com.test.app',
      };

      mockProvider.send.mockRejectedValue(new Error('Network error'));

      await expect(service.sendPrebuilt(deviceData, payload)).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle payload without priority', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
        rawPayload: { aps: { alert: { title: 'Test' } } },
        customPayload: {},
        topic: 'com.test.app',
      };

      mockProvider.send.mockResolvedValue({
        sent: [{ token: 'test_device_token_123' }],
        failed: [],
      });

      const result = await service.sendPrebuilt(deviceData, payload);

      expect(result.success).toBe(true);
      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          rawPayload: payload.rawPayload,
          payload: payload.customPayload,
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
        rawPayload: { aps: { alert: { title: 'Test' } } },
        customPayload: { priority: 10 },
        priority: 10,
        topic: 'com.apocaliss92.zentik', // Include topic in payload
      };

      mockProvider.send.mockResolvedValue({
        sent: [{ token: 'test_device_token_123' }],
        failed: [],
      });

      const result = await service.sendPrebuilt(deviceData, payload);

      expect(result.success).toBe(true);
      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          rawPayload: payload.rawPayload,
          payload: payload.customPayload,
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
          'content-available': 1,
          'thread-id': 'bucket-1',
        },
        enc: expect.any(String),
      });

      // Verify that bucket fields are included in encrypted payload
      expect(result.payload.enc).toBeDefined();
      expect(result.payload.bucketName).toBeUndefined(); // Should be encrypted
      expect(result.payload.bucketIconUrl).toBeUndefined(); // Should be encrypted
      expect(result.payload.bucketColor).toBeUndefined(); // Should be encrypted
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
            subtitle: 'Test Subtitle',
          },
          sound: 'default',
          'mutable-content': 1,
          'content-available': 1,
          'thread-id': 'bucket-1',
        },
        notificationId: 'notification-1',
        bucketId: 'bucket-1',
        bucketName: 'Test Bucket',
        bucketIconUrl: 'https://example.com/bucket-icon.png',
        bucketColor: '#FF0000',
      });

      // Verify no encryption blob for non-encrypted device
      expect(result.payload.enc).toBeUndefined();
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
      expect(result.payload.aps.alert).toEqual({
        title: 'Test Message',
        body: 'Test Body',
        subtitle: 'Test Subtitle',
      });
    });

    it('should include attachmentData in payload (excluding ICON attachments)', async () => {
      const result = await service.buildAPNsPayload(
        mockNotification as any,
        mockUserSettings,
        undefined, // Non-encrypted
      );

      // Should include attachmentData but filter out ICON attachments
      expect(result.payload.attachmentData).toEqual([
        {
          mediaType: 'IMAGE',
          url: 'https://example.com/image.jpg',
          name: 'image.jpg',
        },
        // ICON attachment should be filtered out
      ]);
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
            subtitle: 'Test Subtitle',
          },
        },
        notificationId: 'notification-1',
        bucketId: 'bucket-1',
        // bucketName, bucketIconUrl, bucketColor should be undefined
      });

      expect(result.payload.bucketName).toBeUndefined();
      expect(result.payload.bucketIconUrl).toBeUndefined();
      expect(result.payload.bucketColor).toBeUndefined();
    });

    it('should include actions in payload', async () => {
      const result = await service.buildAPNsPayload(
        mockNotification as any,
        mockUserSettings,
        undefined,
      );

      // Actions should include automatic actions generated from userSettings
      expect(result.payload.actions).toBeDefined();
      expect(Array.isArray(result.payload.actions)).toBe(true);
      // Should include automatic actions based on userSettings
      expect(result.payload.actions.length).toBeGreaterThan(0);
    });

    it('should handle priority correctly', async () => {
      const result = await service.buildAPNsPayload(
        mockNotification as any,
        mockUserSettings,
        undefined,
      );

      expect(result.customPayload.priority).toBe(10);
    });
  });
});
