import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../src/entities/user.entity';
import { UserDevice } from '../src/entities/user-device.entity';
import { Bucket } from '../src/entities/bucket.entity';
import { SystemAccessToken } from '../src/system-access-token/system-access-token.entity';
import { DevicePlatform } from '../src/users/dto';
import { NotificationDeliveryType } from '../src/notifications/notifications.types';
import { CreateMessageDto } from '../src/messages/dto';
import { TestHelpers } from './test-helpers';
import * as bcrypt from 'bcryptjs';

describe('Passthrough Notifications (e2e)', () => {
  let senderApp: INestApplication;
  let receiverApp: INestApplication;
  let senderDataSource: DataSource;
  let receiverDataSource: DataSource;
  let jwtService: JwtService;

  // Test data
  let senderUser: User;
  let receiverUser: User;
  let senderBucket: Bucket;
  let receiverDevice: UserDevice;
  let systemAccessToken: SystemAccessToken;
  let senderJwtToken: string;

  beforeAll(async () => {
    // Create sender application (the one that will send messages)
    const senderModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    senderApp = senderModule.createNestApplication();
    senderApp.useGlobalPipes(new ValidationPipe({ transform: true }));
    await senderApp.init();

    // Create receiver application (the one that will receive passthrough notifications)
    const receiverModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    receiverApp = receiverModule.createNestApplication();
    receiverApp.useGlobalPipes(new ValidationPipe({ transform: true }));
    await receiverApp.init();

    // Get services
    jwtService = senderModule.get<JwtService>(JwtService);
    senderDataSource = senderModule.get<DataSource>(DataSource);
    receiverDataSource = receiverModule.get<DataSource>(DataSource);

    // Wait for servers to be ready
    await TestHelpers.waitForServer(senderApp);
    await TestHelpers.waitForServer(receiverApp);

    // Set up passthrough configuration for sender app
    process.env.PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED = 'true';
    process.env.PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER = `http://localhost:${receiverApp.getHttpServer().address()?.port || 3001}`;
    process.env.PUSH_PASSTHROUGH_TOKEN = 'sat_test_passthrough_token_123';

    // Initialize test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();

    // Close applications
    await senderApp?.close();
    await receiverApp?.close();

    // Reset environment variables
    delete process.env.PUSH_NOTIFICATIONS_PASSTHROUGH_ENABLED;
    delete process.env.PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER;
    delete process.env.PUSH_PASSTHROUGH_TOKEN;
  });

  async function setupTestData() {
    try {
      // Create sender user and bucket
      senderUser = await TestHelpers.createTestUser(senderDataSource, {
        email: 'sender@test.com',
        username: 'sender',
        firstName: 'Sender',
        lastName: 'User',
      });

      // Create JWT token for sender user
      senderJwtToken = TestHelpers.createJwtToken(senderUser, jwtService);

      const bucketRepo = senderDataSource.getRepository(Bucket);
      senderBucket = await bucketRepo.save(
        bucketRepo.create({
          name: 'Test Bucket',
          user: senderUser,
        }),
      );

      // Create receiver user and device
      receiverUser = await TestHelpers.createTestUser(receiverDataSource, {
        email: 'receiver@test.com',
        username: 'receiver',
        firstName: 'Receiver',
        lastName: 'User',
      });

      const receiverDeviceRepo = receiverDataSource.getRepository(UserDevice);
      receiverDevice = await receiverDeviceRepo.save(
        receiverDeviceRepo.create({
          userId: receiverUser.id,
          deviceToken: 'test_device_token_123',
          platform: DevicePlatform.IOS,
          deviceName: 'Test iPhone',
          deviceModel: 'iPhone 15',
          osVersion: '17.0',
          lastUsed: new Date(),
        }),
      );

      // Create system access token for receiver app
      const satRepo = receiverDataSource.getRepository(SystemAccessToken);
      const tokenHash = await bcrypt.hash('test_passthrough_token_123', 10);
      systemAccessToken = await satRepo.save(
        satRepo.create({
          tokenHash: tokenHash,
          maxCalls: 1000,
          calls: 0,
          requester: 'Passthrough Test',
          description: 'Token for passthrough notifications',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        }),
      );
    } catch (error) {
      console.error('Error setting up test data:', error);
      throw error;
    }
  }

  async function cleanupTestData() {
    const entitiesToClean = [
      systemAccessToken,
      receiverDevice,
      receiverUser,
      senderBucket,
      senderUser,
    ];

    // Clean sender data
    await TestHelpers.cleanupTestData(senderDataSource, [
      senderBucket,
      senderUser,
    ]);

    // Clean receiver data
    await TestHelpers.cleanupTestData(receiverDataSource, [
      systemAccessToken,
      receiverDevice,
      receiverUser,
    ]);
  }

  describe('Server-to-Server Passthrough Communication', () => {
    it('should handle passthrough authentication with system access token', async () => {
      const passthroughPayload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: receiverDevice.id,
          deviceToken: receiverDevice.deviceToken,
          platform: receiverDevice.platform,
        }),
      };

      // Test successful authentication with correct token format
      const response = await request(receiverApp.getHttpServer())
        .post('/api/v1/notifications/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send(passthroughPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle passthrough authentication failure', async () => {
      const passthroughPayload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: receiverDevice.id,
          deviceToken: receiverDevice.deviceToken,
          platform: receiverDevice.platform,
        }),
      };

      // Test with invalid token
      await request(receiverApp.getHttpServer())
        .post('/api/v1/notifications/notify-external')
        .set('Authorization', 'Bearer sat_invalid_token')
        .send(passthroughPayload)
        .expect(401);

      // Test with missing token
      await request(receiverApp.getHttpServer())
        .post('/api/v1/notifications/notify-external')
        .send(passthroughPayload)
        .expect(401);

      // Test with wrong token format (not starting with sat_)
      await request(receiverApp.getHttpServer())
        .post('/api/v1/notifications/notify-external')
        .set('Authorization', 'Bearer invalid_format_token')
        .send(passthroughPayload)
        .expect(401);
    });

    it('should handle malformed passthrough payload', async () => {
      // Test with missing notification
      await request(receiverApp.getHttpServer())
        .post('/api/v1/notifications/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send({
          userDevice: JSON.stringify({
            id: receiverDevice.id,
            deviceToken: receiverDevice.deviceToken,
            platform: receiverDevice.platform,
          }),
        })
        .expect(400);

      // Test with missing userDevice
      await request(receiverApp.getHttpServer())
        .post('/api/v1/notifications/notify-external')
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

    it('should increment system access token call count on successful passthrough', async () => {
      const passthroughPayload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: receiverDevice.id,
          deviceToken: receiverDevice.deviceToken,
          platform: receiverDevice.platform,
        }),
      };

      // Get initial call count
      const initialToken = await receiverDataSource
        .getRepository(SystemAccessToken)
        .findOne({ where: { id: systemAccessToken.id } });
      const initialCallCount = initialToken?.calls || 0;

      // Make passthrough request
      const response = await request(receiverApp.getHttpServer())
        .post('/api/v1/notifications/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send(passthroughPayload);

      expect(response.status).toBe(200);

      // Verify call count was incremented
      const updatedToken = await receiverDataSource
        .getRepository(SystemAccessToken)
        .findOne({ where: { id: systemAccessToken.id } });

      expect(updatedToken?.calls).toBe(initialCallCount + 1);
    });
  });

  describe('Message Creation and Passthrough Flow', () => {
    it('should create message successfully with proper authentication', async () => {
      const messageDto: CreateMessageDto = {
        title: 'E2E Test Message',
        subtitle: 'End-to-end test',
        body: 'Testing message creation with proper JWT authentication',
        bucketId: senderBucket.id,
        deliveryType: NotificationDeliveryType.NORMAL,
        attachments: [],
      };

      // Create message with proper JWT authentication
      const messageResponse = await request(senderApp.getHttpServer())
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${senderJwtToken}`)
        .send(messageDto);

      expect(messageResponse.status).toBe(201);
      expect(messageResponse.body.title).toBe(messageDto.title);
      expect(messageResponse.body.bucketId).toBe(senderBucket.id);

      // Verify message was created
      const createdMessage = messageResponse.body;
      expect(createdMessage.id).toBeDefined();
    });

    it('should reject message creation without authentication', async () => {
      const messageDto: CreateMessageDto = {
        title: 'Unauthorized Test Message',
        bucketId: senderBucket.id,
        deliveryType: NotificationDeliveryType.NORMAL,
        attachments: [],
      };

      // Try to create message without JWT token
      await request(senderApp.getHttpServer())
        .post('/api/v1/messages')
        .send(messageDto)
        .expect(401);
    });

    it('should reject message creation with invalid JWT token', async () => {
      const messageDto: CreateMessageDto = {
        title: 'Invalid Token Test Message',
        bucketId: senderBucket.id,
        deliveryType: NotificationDeliveryType.NORMAL,
        attachments: [],
      };

      // Try to create message with invalid JWT token
      await request(senderApp.getHttpServer())
        .post('/api/v1/messages')
        .set('Authorization', 'Bearer invalid_jwt_token')
        .send(messageDto)
        .expect(401);
    });
  });

  describe('Passthrough Notification Payload Validation', () => {
    it('should handle various notification payload formats', async () => {
      const testCases = [
        {
          name: 'minimal notification',
          payload: {
            notification: JSON.stringify({
              id: 'minimal-id',
              title: 'Minimal Title',
            }),
            userDevice: JSON.stringify({
              id: receiverDevice.id,
              deviceToken: receiverDevice.deviceToken,
              platform: receiverDevice.platform,
            }),
          },
          expectedStatus: 200,
        },
        {
          name: 'full notification',
          payload: {
            notification: JSON.stringify({
              id: 'full-id',
              title: 'Full Title',
              subtitle: 'Full Subtitle',
              body: 'Full Body',
              messageId: 'message-123',
              bucketId: 'bucket-123',
            }),
            userDevice: JSON.stringify({
              id: receiverDevice.id,
              userId: receiverUser.id,
              deviceToken: receiverDevice.deviceToken,
              platform: receiverDevice.platform,
              deviceName: 'Test Device',
            }),
          },
          expectedStatus: 200,
        },
        {
          name: 'invalid JSON in notification',
          payload: {
            notification: 'invalid json string',
            userDevice: JSON.stringify({
              id: receiverDevice.id,
              deviceToken: receiverDevice.deviceToken,
              platform: receiverDevice.platform,
            }),
          },
          expectedStatus: 500,
        },
      ];

      for (const testCase of testCases) {
        const response = await request(receiverApp.getHttpServer())
          .post('/api/v1/notifications/notify-external')
          .set('Authorization', `Bearer sat_test_passthrough_token_123`)
          .send(testCase.payload);

        expect(response.status).toBe(testCase.expectedStatus);

        if (testCase.expectedStatus === 200) {
          expect(response.body.success).toBe(true);
        }
      }
    });
  });
});
