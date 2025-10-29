import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { IOSPushService } from '../src/notifications/ios-push.service';
import { SystemAccessTokenService } from '../src/system-access-token/system-access-token.service';
import { SystemAccessTokenStatsInterceptor } from '../src/system-access-token/system-access-token-stats.interceptor';

describe('NotificationsController notify-external (e2e)', () => {
  let app: INestApplication;
  let iosPushService: IOSPushService;
  let satService: SystemAccessTokenService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Override interceptor to a no-op to simplify header injection in tests
      .overrideProvider(SystemAccessTokenStatsInterceptor)
      .useValue({ intercept: (_c: any, next: any) => next.handle() })
      // Mock iOS push provider to always succeed
      .overrideProvider(IOSPushService)
      .useValue({
        sendPrebuilt: jest.fn().mockResolvedValue({ success: true }),
      })
      // Mock SAT service minimal methods used
      .overrideProvider(SystemAccessTokenService)
      .useValue({
        validateSystemToken: jest.fn().mockResolvedValue({ id: 'sat-req-id' }),
        incrementCalls: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    iosPushService = app.get(IOSPushService);
    satService = app.get(SystemAccessTokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with success true and not throw (success path)', async () => {
    // Build minimal body
    const body = {
      platform: 'IOS',
      payload: {
        rawPayload: { aps: { alert: { title: 'Hello' }, sound: 'default' } },
        customPayload: { priority: 10 },
        priority: 10,
        topic: 'com.apocaliss92.zentik.dev',
      },
      deviceData: { token: 'dummy-token' },
    };

    // Call with SAT; route guards will validate via mocked validateSystemToken
    const res = await request(app.getHttpServer())
      .post('/notifications/notify-external')
      .set('Authorization', 'Bearer sat_dummy')
      .send(body)
      .expect(200);

    expect(res.body).toEqual(expect.objectContaining({ success: true }));
    // incrementCalls called once
    expect(satService.incrementCalls).toHaveBeenCalledTimes(1);
  });

  it('should not increment calls on failure', async () => {
    // Force failure
    (iosPushService.sendPrebuilt as any).mockResolvedValueOnce({ success: false });

    const body = {
      platform: 'IOS',
      payload: {
        rawPayload: { aps: { alert: { title: 'Hi' } } },
        customPayload: { priority: 10 },
        priority: 10,
        topic: 'com.apocaliss92.zentik.dev',
      },
      deviceData: { token: 'dummy-token' },
    };

    const res = await request(app.getHttpServer())
      .post('/notifications/notify-external')
      .set('Authorization', 'Bearer sat_dummy')
      .send(body)
      .expect(200);

    expect(res.body).toEqual(expect.objectContaining({ success: false }));
    // incrementCalls must not be invoked additionally in this case
    // Total calls across both tests should be exactly 1
    expect((satService.incrementCalls as any).mock.calls.length).toBe(1);
  });
});


