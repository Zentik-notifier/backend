import { Test, TestingModule } from '@nestjs/testing';
import { IOSPushService } from './ios-push.service';
import { LocaleService } from '../common/services/locale.service';

// Mock apn module
jest.mock('apn', () => ({
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
}), { virtual: true });

describe('IOSPushService', () => {
  let service: IOSPushService;
  let mockProvider: any;

  const mockLocaleService = {
    getLocale: jest.fn().mockReturnValue('en'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IOSPushService,
        {
          provide: LocaleService,
          useValue: mockLocaleService,
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
});
