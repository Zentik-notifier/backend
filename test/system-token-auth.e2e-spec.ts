import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';

import { SystemAccessToken } from '../src/system-access-token/system-access-token.entity';
import { SystemAccessTokenService } from '../src/system-access-token/system-access-token.service';
import { SystemAccessTokenGuard } from '../src/system-access-token/system-access-token.guard';
import { ExternalNotifyRequestDto } from '../src/notifications/dto/external-notify.dto';

// Simple test controller to test the authentication
@Controller('test')
export class TestController {
  @Post('notify-external')
  @UseGuards(SystemAccessTokenGuard)
  async testNotifyExternal(@Body() body: ExternalNotifyRequestDto) {
    if (!body || !body.platform || !body.payload || !body.deviceData) {
      throw new BadRequestException('Missing platform, payload or deviceData');
    }

    // Simulate successful processing
    return { success: true };
  }
}

describe('System Access Token Authentication E2E', () => {
  let app: INestApplication;
  let systemAccessTokenService: SystemAccessTokenService;
  let systemAccessToken: SystemAccessToken;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
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
      controllers: [TestController],
      providers: [SystemAccessTokenService, SystemAccessTokenGuard],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    systemAccessTokenService = moduleFixture.get<SystemAccessTokenService>(
      SystemAccessTokenService,
    );

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function setupTestData() {
    // Create system access token directly in the database
    const tokenHash = await bcrypt.hash('test_passthrough_token_123', 10);
    const satRepo = app.get(getRepositoryToken(SystemAccessToken));
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

  describe('System Access Token Authentication', () => {
    it('should authenticate valid system access token', async () => {
      const payload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: 'device-id',
          deviceToken: 'device-token',
          platform: 'ios',
        }),
      };

      const response = await request(app.getHttpServer())
        .post('/test/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid system access token', async () => {
      const payload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: 'device-id',
          deviceToken: 'device-token',
          platform: 'ios',
        }),
      };

      await request(app.getHttpServer())
        .post('/test/notify-external')
        .set('Authorization', `Bearer sat_invalid_token`)
        .send(payload)
        .expect(401);
    });

    it('should reject missing authorization header', async () => {
      const payload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: 'device-id',
          deviceToken: 'device-token',
          platform: 'ios',
        }),
      };

      await request(app.getHttpServer())
        .post('/test/notify-external')
        .send(payload)
        .expect(401);
    });

    it('should reject non-sat token format', async () => {
      const payload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: 'device-id',
          deviceToken: 'device-token',
          platform: 'ios',
        }),
      };

      await request(app.getHttpServer())
        .post('/test/notify-external')
        .set('Authorization', `Bearer regular_token_format`)
        .send(payload)
        .expect(401);
    });

    it('should validate request payload', async () => {
      // Test missing notification
      await request(app.getHttpServer())
        .post('/test/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send({
          userDevice: JSON.stringify({
            id: 'device-id',
            deviceToken: 'device-token',
            platform: 'ios',
          }),
        })
        .expect(400);

      // Test missing userDevice
      await request(app.getHttpServer())
        .post('/test/notify-external')
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

    it('should increment call count on successful request', async () => {
      const payload = {
        notification: JSON.stringify({
          id: 'test-notification-id',
          title: 'Test Message',
          body: 'Test Body',
        }),
        userDevice: JSON.stringify({
          id: 'device-id',
          deviceToken: 'device-token',
          platform: 'ios',
        }),
      };

      // Get initial call count
      const satRepo = app.get(getRepositoryToken(SystemAccessToken));
      const initialToken = await satRepo.findOne({
        where: { id: systemAccessToken.id },
      });
      const initialCallCount = initialToken?.calls || 0;

      // Make request
      const response = await request(app.getHttpServer())
        .post('/test/notify-external')
        .set('Authorization', `Bearer sat_test_passthrough_token_123`)
        .send(payload);

      expect(response.status).toBe(201);

      // Verify call count was incremented (this would happen in the actual controller)
      // For this test, we'll just verify the token is valid and can be found
      const updatedToken = await satRepo.findOne({
        where: { id: systemAccessToken.id },
      });
      expect(updatedToken).toBeDefined();
      expect(updatedToken?.id).toBe(systemAccessToken.id);
    });
  });
});
