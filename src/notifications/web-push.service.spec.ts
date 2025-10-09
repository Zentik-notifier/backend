import { Test, TestingModule } from '@nestjs/testing';
import { WebPushService } from './web-push.service';
import { LocaleService } from '../common/services/locale.service';
import { ServerSettingsService } from '../server-settings/server-settings.service';

// Mock web-push
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

// Mock notification-actions.util
jest.mock('./notification-actions.util', () => ({
  generateAutomaticActions: jest.fn().mockReturnValue([]),
  DevicePlatform: {
    WEB: 'WEB',
    IOS: 'IOS',
    ANDROID: 'ANDROID',
  },
}));

describe('WebPushService', () => {
  let service: WebPushService;
  let mockWebPush: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebPushService,
        {
          provide: LocaleService,
          useValue: {
            getLocale: jest.fn().mockReturnValue('en'),
          },
        },
        {
          provide: ServerSettingsService,
          useValue: {
            getSettingByType: jest.fn().mockResolvedValue({
              valueText: 'test-vapid-subject',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WebPushService>(WebPushService);

    // Mock web-push
    const webPush = require('web-push');
    mockWebPush = webPush;
    (service as any).webpush = webPush;

    jest.clearAllMocks();
  });

  describe('sendPrebuilt', () => {
    it('should send Web Push prebuilt notification successfully', async () => {
      const deviceData = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        p256dh: 'test_p256dh_key',
        auth: 'test_auth_secret',
        publicKey: 'test_vapid_public_key',
        privateKey: 'test_vapid_private_key',
      };

      const payload = JSON.stringify({
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
      });

      mockWebPush.sendNotification.mockResolvedValue(undefined);

      const result = await service.sendPrebuilt(deviceData, payload);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        success: true,
      });

      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          keys: {
            p256dh: 'test_p256dh_key',
            auth: 'test_auth_secret',
          },
        },
        payload,
        {
          vapidDetails: {
            subject: 'test-vapid-subject',
            publicKey: 'test_vapid_public_key',
            privateKey: 'test_vapid_private_key',
          },
        },
      );
    });

    it('should handle Web Push notification failure', async () => {
      const deviceData = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        p256dh: 'test_p256dh_key',
        auth: 'test_auth_secret',
        publicKey: 'test_vapid_public_key',
        privateKey: 'test_vapid_private_key',
      };

      const payload = JSON.stringify({
        title: 'Test Web Notification',
        body: 'Test Web Body',
      });

      mockWebPush.sendNotification.mockRejectedValue(
        new Error('Invalid subscription'),
      );

      const result = await service.sendPrebuilt(deviceData, payload);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        success: false,
        error: 'Invalid subscription',
      });
    });

    it('should handle payload as object instead of string', async () => {
      const deviceData = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        p256dh: 'test_p256dh_key',
        auth: 'test_auth_secret',
        publicKey: 'test_vapid_public_key',
        privateKey: 'test_vapid_private_key',
      };

      const payload = {
        title: 'Test Web Notification',
        body: 'Test Web Body',
        url: '/',
        notificationId: 'test-notification-id',
      };

      mockWebPush.sendNotification.mockResolvedValue(undefined);

      const result = await service.sendPrebuilt(deviceData, payload as any);

      expect(result.success).toBe(true);
      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          keys: {
            p256dh: 'test_p256dh_key',
            auth: 'test_auth_secret',
          },
        },
        payload,
        {
          vapidDetails: {
            subject: 'test-vapid-subject',
            publicKey: 'test_vapid_public_key',
            privateKey: 'test_vapid_private_key',
          },
        },
      );
    });

    it('should use VAPID subject from ServerSettings', async () => {
      // Test verifies that the service correctly uses the VAPID subject from ServerSettings
      // The mock already returns 'test-vapid-subject' as configured in beforeEach
      
      const deviceData = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        p256dh: 'test_p256dh_key',
        auth: 'test_auth_secret',
        publicKey: 'test_vapid_public_key',
        privateKey: 'test_vapid_private_key',
      };

      const payload = JSON.stringify({
        title: 'Test Web Notification',
        body: 'Test Web Body',
      });

      mockWebPush.sendNotification.mockResolvedValue(undefined);

      const result = await service.sendPrebuilt(deviceData, payload);

      expect(result.success).toBe(true);
      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        payload,
        {
          vapidDetails: {
            subject: 'test-vapid-subject',
            publicKey: 'test_vapid_public_key',
            privateKey: 'test_vapid_private_key',
          },
        },
      );
    });

    it('should handle web-push throwing error', async () => {
      const deviceData = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        p256dh: 'test_p256dh_key',
        auth: 'test_auth_secret',
        publicKey: 'test_vapid_public_key',
        privateKey: 'test_vapid_private_key',
      };

      const payload = JSON.stringify({
        title: 'Test Web Notification',
        body: 'Test Web Body',
      });

      mockWebPush.sendNotification.mockRejectedValue(
        new Error('Web Push service error'),
      );

      const result = await service.sendPrebuilt(deviceData, payload);

      expect(result.success).toBe(false);
      expect(result.results[0].error).toBe('Web Push service error');
    });
  });
});
