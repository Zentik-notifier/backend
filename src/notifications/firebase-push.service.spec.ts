import { Test, TestingModule } from '@nestjs/testing';
import { FirebasePushService } from './firebase-push.service';
import { LocaleService } from '../common/services/locale.service';
import { IOSPushService } from './ios-push.service';
import { ConfigService } from '@nestjs/config';

// Mock firebase-admin
const mockSendEachForMulticast = jest.fn();
jest.mock('firebase-admin', () => ({
  messaging: jest.fn(() => ({
    sendEachForMulticast: mockSendEachForMulticast,
  })),
}));

describe('FirebasePushService', () => {
  let service: FirebasePushService;

  const mockLocaleService = {
    getLocale: jest.fn().mockReturnValue('en'),
  };

  const mockIOSPushService = {
    buildAPNsPayload: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebasePushService,
        {
          provide: LocaleService,
          useValue: mockLocaleService,
        },
        {
          provide: IOSPushService,
          useValue: mockIOSPushService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<FirebasePushService>(FirebasePushService);
    
    // Mock Firebase app
    (service as any).app = {
      messaging: () => ({
        sendEachForMulticast: mockSendEachForMulticast,
      }),
    };

    jest.clearAllMocks();
  });

  describe('sendPrebuilt', () => {
    it('should send Firebase prebuilt notification successfully', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
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
      };

      mockSendEachForMulticast.mockResolvedValueOnce({
        successCount: 1,
        failureCount: 0,
        responses: [
          {
            success: true,
            messageId: 'test-message-id',
          },
        ],
      });

      const result = await service.sendPrebuilt(deviceData, payload as any);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(payload);
    });

    it('should handle Firebase notification failure', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
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
      };

      mockSendEachForMulticast.mockResolvedValueOnce({
        successCount: 0,
        failureCount: 1,
        responses: [
          {
            success: false,
            error: {
              code: 'invalid-registration-token',
              message: 'Invalid registration token',
            },
          },
        ],
      });

      const result = await service.sendPrebuilt(deviceData, payload as any);

      expect(result.success).toBe(false);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(payload);
    });

    it('should handle payload without tokens array', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
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
      };

      mockSendEachForMulticast.mockResolvedValueOnce({
        successCount: 1,
        failureCount: 0,
        responses: [
          {
            success: true,
            messageId: 'test-message-id',
          },
        ],
      });

      const result = await service.sendPrebuilt(deviceData, payload as any);

      expect(result.success).toBe(true);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith({
        ...payload,
        tokens: ['test_device_token_123'],
      });
    });

    it('should handle Firebase messaging throwing error', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
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
      };

      mockSendEachForMulticast.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(service.sendPrebuilt(deviceData, payload as any)).rejects.toThrow('Firebase error');
    });

    it('should handle empty tokens array', async () => {
      const deviceData = {
        token: 'test_device_token_123',
      };

      const payload = {
        tokens: [],
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
      };

      mockSendEachForMulticast.mockResolvedValueOnce({
        successCount: 0,
        failureCount: 0,
        responses: [],
      });

      const result = await service.sendPrebuilt(deviceData, payload as any);

      expect(result.success).toBe(false); // Should be false when no tokens are sent
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith({
        ...payload,
        tokens: ['test_device_token_123'], // Should add token from deviceData
      });
    });
  });
});
