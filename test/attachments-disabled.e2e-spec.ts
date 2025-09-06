import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtOrAccessTokenGuard } from '../src/auth/guards/jwt-or-access-token.guard';

describe('Attachments Disabled (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    // Mock JWT guards to allow requests
    const mockJwtOrAccessTokenGuard = {
      canActivate: () => true,
    };
    const mockJwtOrAccessTokenGuard = {
      canActivate: () => true,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue(mockJwtOrAccessTokenGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('when ATTACHMENTS_ENABLED is false', () => {
    beforeEach(() => {
      process.env.ATTACHMENTS_ENABLED = 'false';
    });

    afterEach(() => {
      delete process.env.ATTACHMENTS_ENABLED;
    });

    it('should block POST /attachments/upload', () => {
      return request(app.getHttpServer())
        .post('/attachments/upload')
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('mediaType', 'text/plain')
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe('Attachments are currently disabled');
        });
    });

    it('should block POST /messages/with-attachment', () => {
      return request(app.getHttpServer())
        .post('/messages/with-attachment')
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('title', 'Test Message')
        .field('bucketId', 'test-bucket')
        .field('deliveryType', 'PUSH')
        .field(
          'attachmentOptions',
          JSON.stringify({
            mediaType: 'text/plain',
            name: 'test.txt',
          }),
        )
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe('Attachments are currently disabled');
        });
    });
  });

  describe('when ATTACHMENTS_ENABLED is true', () => {
    beforeEach(() => {
      process.env.ATTACHMENTS_ENABLED = 'true';
    });

    afterEach(() => {
      delete process.env.ATTACHMENTS_ENABLED;
    });

    it('should allow POST /attachments/upload (but fail due to missing auth)', () => {
      return request(app.getHttpServer())
        .post('/attachments/upload')
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('mediaType', 'text/plain')
        .expect(401); // Should fail due to auth, not attachments disabled
    });

    it('should allow POST /messages/with-attachment (but fail due to missing auth)', () => {
      return request(app.getHttpServer())
        .post('/messages/with-attachment')
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('title', 'Test Message')
        .field('bucketId', 'test-bucket')
        .field('deliveryType', 'PUSH')
        .field(
          'attachmentOptions',
          JSON.stringify({
            mediaType: 'text/plain',
            name: 'test.txt',
          }),
        )
        .expect(401); // Should fail due to auth, not attachments disabled
    });
  });

  describe('when ATTACHMENTS_ENABLED is not set', () => {
    beforeEach(() => {
      delete process.env.ATTACHMENTS_ENABLED;
    });

    it('should block POST /attachments/upload', () => {
      return request(app.getHttpServer())
        .post('/attachments/upload')
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('mediaType', 'text/plain')
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe('Attachments are currently disabled');
        });
    });

    it('should block POST /messages/with-attachment', () => {
      return request(app.getHttpServer())
        .post('/messages/with-attachment')
        .attach('file', Buffer.from('test'), 'test.txt')
        .field('title', 'Test Message')
        .field('bucketId', 'test-bucket')
        .field('deliveryType', 'PUSH')
        .field(
          'attachmentOptions',
          JSON.stringify({
            mediaType: 'text/plain',
            name: 'test.txt',
          }),
        )
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe('Attachments are currently disabled');
        });
    });
  });
});
