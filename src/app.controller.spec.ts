import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttachmentsService } from './attachments/attachments.service';
import { EmailService } from './auth/email.service';
import { JwtOrAccessTokenGuard } from './auth/guards/jwt-or-access-token.guard';
import { OAuthProvidersService } from './oauth-providers/oauth-providers.service';
import { AccessTokenService } from './auth/access-token.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: OAuthProvidersService,
          useValue: {
            findEnabledProvidersPublic: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: EmailService,
          useValue: { isEmailEnabled: jest.fn().mockReturnValue(true) },
        },
        {
          provide: AccessTokenService,
          useValue: { validateAccessToken: jest.fn() },
        },
        {
          provide: AttachmentsService,
          useValue: { isAttachmentsEnabled: jest.fn().mockReturnValue(true) },
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status (public endpoint)', () => {
      const result = appController.getHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('version');
    });
  });

  describe('version', () => {
    it('should return version info (protected endpoint)', () => {
      const result = appController.getVersion();
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
