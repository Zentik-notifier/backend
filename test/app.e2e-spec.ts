import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtOrAccessTokenGuard } from '../src/auth/guards/jwt-or-access-token.guard';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/health (GET)', () => {
    it('should return health status with version (public endpoint)', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('version');
        });
    });
  });

  describe('/version (GET)', () => {
    it('should return version info (protected endpoint)', () => {
      return request(app.getHttpServer())
        .get('/version')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('version');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });
});
