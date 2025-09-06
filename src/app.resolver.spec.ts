import { Test, TestingModule } from '@nestjs/testing';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { JwtOrAccessTokenGuard } from './auth/guards/jwt-or-access-token.guard';

describe('AppResolver', () => {
  let resolver: AppResolver;
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppResolver, AppService],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<AppResolver>(AppResolver);
    appService = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('healthcheck', () => {
    it('should return "ok"', () => {
      expect(resolver.healthcheck()).toBe('ok');
    });
  });

  describe('getBackendVersion', () => {
    it('should return version from app service', async () => {
      const mockVersion = '1.0.0';
      jest.spyOn(appService, 'getVersion').mockReturnValue(mockVersion);

      const result = await resolver.getBackendVersion();
      expect(result).toBe(mockVersion);
      expect(appService.getVersion).toHaveBeenCalled();
    });
  });
});
