import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';

import { SystemAccessToken } from '../src/system-access-token/system-access-token.entity';
import { SystemAccessTokenService } from '../src/system-access-token/system-access-token.service';
import { SystemAccessTokenGuard } from '../src/system-access-token/system-access-token.guard';
import { ExternalNotifyRequestDto } from '../src/notifications/dto/external-notify.dto';

// Mock receiver server controller
@Controller('notifications')
export class MockReceiverController {
  @Post('notify-external')
  @UseGuards(SystemAccessTokenGuard)
  async notifyExternal(@Body() body: ExternalNotifyRequestDto) {
    if (!body || !body.platform || !body.payload || !body.deviceData) {
      throw new BadRequestException('Missing platform, payload or deviceData');
    }

    // Simulate successful push notification delivery
    return {
      success: true,
      platform: body.platform,
      payload: body.payload,
      deviceData: body.deviceData,
    };
  }
}

// Mock sender service that sends passthrough requests
@Injectable()
export class MockSenderService {
  constructor(private configService: ConfigService) {}

  async sendPassthroughNotification(
    notification: any,
    userDevice: any,
  ): Promise<{ success: boolean; error?: string }> {
    const passthroughEnabled =
      this.configService.get<string>(
        'PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED',
      ) === 'true';
    const passthroughServer = this.configService.get<string>(
      'PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER',
    );
    const passthroughToken = this.configService.get<string>(
      'PUSH_PASSTHROUGH_TOKEN',
    );

    if (!passthroughEnabled || !passthroughServer || !passthroughToken) {
      return { success: false, error: 'Passthrough not configured' };
    }

    try {
      const url = `${passthroughServer.replace(/\/$/, '')}/notifications/notify-external`;
      const payload = {
        notification: JSON.stringify(notification),
        userDevice: JSON.stringify(userDevice),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${passthroughToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        return { success: true };
      }

      const error =
        (data && (data.error || data.message)) || `HTTP ${response.status}`;
      return { success: false, error };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Passthrough error' };
    }
  }
}

// Mock sender controller
@Controller('messages')
export class MockSenderController {
  constructor(private senderService: MockSenderService) {}

  @Post()
  async createMessage(@Body() messageDto: any) {
    // Simulate message creation
    const message = {
      id: 'msg-' + Date.now(),
      title: messageDto.title,
      body: messageDto.body,
      createdAt: new Date(),
    };

    // Simulate notification creation
    const notification = {
      id: 'notif-' + Date.now(),
      title: message.title,
      body: message.body,
      messageId: message.id,
    };

    // Simulate user device (would normally come from database)
    const userDevice = {
      id: messageDto.deviceId || 'device-123',
      deviceToken: messageDto.deviceToken || 'device-token-123',
      platform: 'ios',
    };

    // Send via passthrough
    const result = await this.senderService.sendPassthroughNotification(
      notification,
      userDevice,
    );

    return {
      message,
      notification,
      passthroughResult: result,
    };
  }
}

describe('Server-to-Server Passthrough E2E', () => {
  let senderApp: INestApplication;
  let receiverApp: INestApplication;
  let systemAccessToken: SystemAccessToken;
  let senderService: MockSenderService;

  beforeAll(async () => {
    // Create receiver app (the server that receives passthrough notifications)
    const receiverModule: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [SystemAccessToken],
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([SystemAccessToken]),
      ],
      controllers: [MockReceiverController],
      providers: [SystemAccessTokenService, SystemAccessTokenGuard],
    }).compile();

    receiverApp = receiverModule.createNestApplication();
    receiverApp.useGlobalPipes(new ValidationPipe({ transform: true }));
    await receiverApp.init();

    // Get receiver server address
    const receiverServer = receiverApp.getHttpServer();
    const receiverAddress = receiverServer.address();

    // Wait for server to be listening
    if (!receiverAddress) {
      // Force the server to listen on a specific port
      await new Promise<void>((resolve) => {
        receiverServer.listen(0, () => {
          resolve();
        });
      });
    }

    const finalAddress = receiverServer.address();
    const receiverPort =
      finalAddress && typeof finalAddress === 'object'
        ? finalAddress.port
        : 3001;
    const receiverUrl = `http://localhost:${receiverPort}`;

    console.log('Receiver server listening on:', receiverUrl);

    // Create sender app (the server that sends messages and triggers passthrough)
    const senderModule: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED: 'true',
              PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER: receiverUrl,
              PUSH_PASSTHROUGH_TOKEN: 'sat_test_passthrough_token_123',
            }),
          ],
        }),
      ],
      controllers: [MockSenderController],
      providers: [MockSenderService, ConfigService],
    }).compile();

    senderApp = senderModule.createNestApplication();
    senderApp.useGlobalPipes(new ValidationPipe({ transform: true }));
    await senderApp.init();

    senderService = senderModule.get<MockSenderService>(MockSenderService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await receiverApp?.close();
    await senderApp?.close();
  });

  async function setupTestData() {
    // Create system access token in receiver app
    const tokenHash = await bcrypt.hash('test_passthrough_token_123', 10);
    const satRepo = receiverApp.get(getRepositoryToken(SystemAccessToken));
    systemAccessToken = await satRepo.save(
      satRepo.create({
        tokenHash: tokenHash,
        maxCalls: 1000,
        calls: 0,
        requester: 'Passthrough Test',
        description: 'Token for passthrough notifications',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      }),
    );
  }

  describe('Complete Passthrough Flow', () => {
    it('should successfully send message from sender to receiver via passthrough', async () => {
      const messageDto = {
        title: 'Test Passthrough Message',
        body: 'This message should be sent via passthrough',
        deviceId: 'test-device-123',
        deviceToken: 'test-device-token-123',
      };

      // Send message creation request to sender server
      const response = await request(senderApp.getHttpServer())
        .post('/messages')
        .send(messageDto);

      expect(response.status).toBe(201);
      expect(response.body.message).toBeDefined();
      expect(response.body.message.title).toBe(messageDto.title);
      expect(response.body.notification).toBeDefined();
      expect(response.body.passthroughResult).toBeDefined();
      expect(response.body.passthroughResult.success).toBe(true);
    });

    it('should handle passthrough authentication failure', async () => {
      // Temporarily change the passthrough token to an invalid one
      const configService = senderApp.get<ConfigService>(ConfigService);
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'PUSH_PASSTHROUGH_TOKEN') {
          return 'sat_invalid_token';
        }
        return configService.get(key);
      });

      const messageDto = {
        title: 'Test Failed Passthrough',
        body: 'This should fail authentication',
        deviceId: 'test-device-123',
        deviceToken: 'test-device-token-123',
      };

      const response = await request(senderApp.getHttpServer())
        .post('/messages')
        .send(messageDto);

      expect(response.status).toBe(201);
      expect(response.body.passthroughResult.success).toBe(false);
      expect(response.body.passthroughResult.error).toContain('401');

      // Restore the original mock
      jest.restoreAllMocks();
    });

    it('should handle receiver server unavailable', async () => {
      // Temporarily change the passthrough server to an invalid URL
      const configService = senderApp.get<ConfigService>(ConfigService);
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER') {
          return 'http://localhost:99999'; // Invalid port
        }
        return configService.get(key);
      });

      const messageDto = {
        title: 'Test Server Unavailable',
        body: 'This should fail due to server unavailable',
        deviceId: 'test-device-123',
        deviceToken: 'test-device-token-123',
      };

      const response = await request(senderApp.getHttpServer())
        .post('/messages')
        .send(messageDto);

      expect(response.status).toBe(201);
      expect(response.body.passthroughResult.success).toBe(false);
      expect(response.body.passthroughResult.error).toBeDefined();

      // Restore the original mock
      jest.restoreAllMocks();
    });

    it('should handle passthrough disabled', async () => {
      // Temporarily disable passthrough
      const configService = senderApp.get<ConfigService>(ConfigService);
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED') {
          return 'false';
        }
        return configService.get(key);
      });

      const messageDto = {
        title: 'Test Passthrough Disabled',
        body: 'This should not use passthrough',
        deviceId: 'test-device-123',
        deviceToken: 'test-device-token-123',
      };

      const response = await request(senderApp.getHttpServer())
        .post('/messages')
        .send(messageDto);

      expect(response.status).toBe(201);
      expect(response.body.passthroughResult.success).toBe(false);
      expect(response.body.passthroughResult.error).toBe(
        'Passthrough not configured',
      );

      // Restore the original mock
      jest.restoreAllMocks();
    });
  });

  describe('Receiver Server Direct Testing', () => {
    it('should accept valid passthrough requests directly', async () => {
      const payload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Direct Test Message',
          body: 'Testing direct receiver endpoint',
        }),
        userDevice: JSON.stringify({
          id: 'device-id',
          deviceToken: 'device-token',
          platform: 'ios',
        }),
      };

      const response = await request(receiverApp.getHttpServer())
        .post('/notifications/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.notificationId).toBe('test-notification-id');
      expect(response.body.deviceToken).toBe('device-token');
    });

    it('should reject invalid JSON in passthrough requests', async () => {
      const payload = {
        notification: 'invalid json string',
        userDevice: JSON.stringify({
          id: 'device-id',
          deviceToken: 'device-token',
          platform: 'ios',
        }),
      };

      await request(receiverApp.getHttpServer())
        .post('/notifications/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send(payload)
        .expect(400);
    });
  });
});
