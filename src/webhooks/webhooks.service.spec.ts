import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserWebhook, HttpMethod, User } from '../entities';
import { UserRole } from '../users/users.types';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { WebhooksService } from './webhooks.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('WebhooksService', () => {
  let service: WebhooksService;
  let webhookRepository: Repository<UserWebhook>;

  const mockWebhookRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockEntityPermissionService = {
    hasPermissions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getRepositoryToken(UserWebhook),
          useValue: mockWebhookRepository,
        },
        {
          provide: EntityPermissionService,
          useValue: mockEntityPermissionService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    webhookRepository = module.get<Repository<UserWebhook>>(
      getRepositoryToken(UserWebhook),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeWebhook', () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedpassword',
      hasPassword: true,
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
      emailConfirmed: true,
      emailConfirmationToken: null,
      emailConfirmationTokenRequestedAt: null,
      resetToken: null,
      resetTokenRequestedAt: null,
      avatar: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      buckets: [],
      userBuckets: [],
      devices: [],
      sessions: [],
      accessTokens: [],
      identities: [],
      webhooks: [],
    };

    const mockWebhook: UserWebhook = {
      id: 'webhook-1',
      name: 'Test Webhook',
      method: HttpMethod.POST,
      url: 'https://example.com/webhook',
      headers: [
        { key: 'Authorization', value: 'Bearer token123' },
        { key: 'X-Custom', value: 'custom-value' },
      ],
      body: { template: 'notification' },
      user: mockUser,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // Mock the getWebhookById method to return our test webhook
      jest.spyOn(service, 'getWebhookById').mockResolvedValue(mockWebhook);
    });

    it('should execute webhook successfully with POST method', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await service.executeWebhook('webhook-1', 'user-1');

      expect(service.getWebhookById).toHaveBeenCalledWith('webhook-1', 'user-1');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Zentik-Webhook/1.0',
            'Authorization': 'Bearer token123',
            'X-Custom': 'custom-value',
          },
          signal: expect.any(AbortSignal),
        })
      );

      // Check body separately to handle dynamic timestamp
      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body).toEqual({
        template: 'notification',
        timestamp: expect.any(String),
      });
    });

    it('should execute webhook with GET method without body', async () => {
      const getWebhook = {
        ...mockWebhook,
        method: HttpMethod.GET,
      };

      jest.spyOn(service, 'getWebhookById').mockResolvedValue(getWebhook);

      const mockResponse = {
        ok: true,
        status: 200,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await service.executeWebhook('webhook-1', 'user-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Zentik-Webhook/1.0',
            'Authorization': 'Bearer token123',
            'X-Custom': 'custom-value',
          },
          signal: expect.any(AbortSignal),
        }
      );
    });

    it('should execute webhook without custom body', async () => {
      const webhookWithoutBody = {
        ...mockWebhook,
        body: null,
      };

      jest.spyOn(service, 'getWebhookById').mockResolvedValue(webhookWithoutBody);

      const mockResponse = {
        ok: true,
        status: 200,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await service.executeWebhook('webhook-1', 'user-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Zentik-Webhook/1.0',
            'Authorization': 'Bearer token123',
            'X-Custom': 'custom-value',
          },
          signal: expect.any(AbortSignal),
        })
      );

      // Check body separately
      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body).toEqual({
        timestamp: expect.any(String),
      });
    });

    it('should handle webhook HTTP error response', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Should not throw error
      await expect(service.executeWebhook('webhook-1', 'user-1')).resolves.not.toThrow();

      expect(mockResponse.text).toHaveBeenCalled();
    });

    it('should handle webhook network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Should not throw error
      await expect(service.executeWebhook('webhook-1', 'user-1')).resolves.not.toThrow();
    });

    it('should handle webhook timeout', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValue(timeoutError);

      // Should not throw error
      await expect(service.executeWebhook('webhook-1', 'user-1')).resolves.not.toThrow();
    });

    it('should execute webhook without custom headers', async () => {
      const webhookWithoutHeaders = {
        ...mockWebhook,
        headers: [],
      };

      jest.spyOn(service, 'getWebhookById').mockResolvedValue(webhookWithoutHeaders);

      const mockResponse = {
        ok: true,
        status: 200,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await service.executeWebhook('webhook-1', 'user-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Zentik-Webhook/1.0',
          },
          signal: expect.any(AbortSignal),
        })
      );
    });
  });
});
