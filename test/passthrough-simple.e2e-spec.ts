import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';

// Import only the necessary entities and modules
import { Attachment } from '../src/entities/attachment.entity';
import { Bucket } from '../src/entities/bucket.entity';
import { Message } from '../src/entities/message.entity';
import { UserAccessToken } from '../src/entities/user-access-token.entity';
import { UserBucket } from '../src/entities/user-bucket.entity';
import { UserDevice } from '../src/entities/user-device.entity';
import { UserIdentity } from '../src/entities/user-identity.entity';
import { UserSession } from '../src/entities/user-session.entity';
import { UserWebhook } from '../src/entities/user-webhook.entity';
import { User } from '../src/entities/user.entity';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { PushNotificationOrchestratorService } from '../src/notifications/push-orchestrator.service';
import { SystemAccessToken } from '../src/system-access-token/system-access-token.entity';
import { SystemAccessTokenGuard } from '../src/system-access-token/system-access-token.guard';
import { SystemAccessTokenService } from '../src/system-access-token/system-access-token.service';
import { DevicePlatform } from '../src/users/dto';

describe('Passthrough Notifications Simple E2E', () => {
  let app: INestApplication;
  let systemAccessTokenService: SystemAccessTokenService;
  let jwtService: JwtService;

  // Test data
  let systemAccessToken: SystemAccessToken;
  let testDevice: UserDevice;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            User,
            UserDevice,
            Bucket,
            SystemAccessToken,
            Message,
            UserAccessToken,
            UserSession,
            UserWebhook,
            UserBucket,
            UserIdentity,
            Attachment,
          ],
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([
          SystemAccessToken,
          UserDevice,
          Message,
          UserAccessToken,
          UserSession,
          UserWebhook,
          UserBucket,
          UserIdentity,
          Attachment,
        ]),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [NotificationsController],
      providers: [
        SystemAccessTokenService,
        SystemAccessTokenGuard,
        {
          provide: PushNotificationOrchestratorService,
          useValue: {
            sendPushToSingleDeviceStateless: jest
              .fn()
              .mockResolvedValue({ success: true }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    systemAccessTokenService = moduleFixture.get<SystemAccessTokenService>(
      SystemAccessTokenService,
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function setupTestData() {
    // Create system access token
    const tokenHash = await bcrypt.hash('test_passthrough_token_123', 10);
    const satRepo = app.get('SystemAccessTokenRepository');
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

    // Create test device
    const deviceRepo = app.get('UserDeviceRepository');
    testDevice = await deviceRepo.save(
      deviceRepo.create({
        userId: 'test-user-id',
        deviceToken: 'test_device_token_123',
        platform: DevicePlatform.IOS,
        deviceName: 'Test iPhone',
        deviceModel: 'iPhone 15',
        osVersion: '17.0',
        lastUsed: new Date(),
      }),
    );
  }

  describe('System Access Token Authentication', () => {
    it('should authenticate valid system access token', async () => {
      const passthroughPayload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: testDevice.id,
          deviceToken: testDevice.deviceToken,
          platform: testDevice.platform,
        }),
      };

      const response = await request(app.getHttpServer())
        .post('/notifications/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send(passthroughPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid system access token', async () => {
      const passthroughPayload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: testDevice.id,
          deviceToken: testDevice.deviceToken,
          platform: testDevice.platform,
        }),
      };

      await request(app.getHttpServer())
        .post('/notifications/notify-external')
        .set('Authorization', `Bearer sat_invalid_token`)
        .send(passthroughPayload)
        .expect(401);
    });

    it('should reject missing authorization header', async () => {
      const passthroughPayload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: testDevice.id,
          deviceToken: testDevice.deviceToken,
          platform: testDevice.platform,
        }),
      };

      await request(app.getHttpServer())
        .post('/notifications/notify-external')
        .send(passthroughPayload)
        .expect(401);
    });
  });

  describe('Payload Validation', () => {
    it('should reject missing notification field', async () => {
      await request(app.getHttpServer())
        .post('/notifications/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send({
          userDevice: JSON.stringify({
            id: testDevice.id,
            deviceToken: testDevice.deviceToken,
            platform: testDevice.platform,
          }),
        })
        .expect(400);
    });

    it('should reject missing userDevice field', async () => {
      await request(app.getHttpServer())
        .post('/notifications/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send({
          notification: JSON.stringify({
            id: 'test-notification-id',
            title: 'Test Message',
            body: 'Test Body',
          }),
        })
        .expect(400);
    });
  });
});
