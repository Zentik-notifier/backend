import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsConfigService } from './attachments-config.service';

describe('AttachmentsConfigService', () => {
  let service: AttachmentsConfigService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AttachmentsConfigService>(AttachmentsConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEnabled', () => {
    it('should return true when ATTACHMENTS_ENABLED is "true"', () => {
      jest.spyOn(configService, 'get').mockReturnValue('true');
      expect(service.isEnabled).toBe(true);
    });

    it('should return true when ATTACHMENTS_ENABLED is "1"', () => {
      jest.spyOn(configService, 'get').mockReturnValue('1');
      expect(service.isEnabled).toBe(true);
    });

    it('should return true when ATTACHMENTS_ENABLED is "TRUE"', () => {
      jest.spyOn(configService, 'get').mockReturnValue('TRUE');
      expect(service.isEnabled).toBe(true);
    });

    it('should return false when ATTACHMENTS_ENABLED is "false"', () => {
      jest.spyOn(configService, 'get').mockReturnValue('false');
      expect(service.isEnabled).toBe(false);
    });

    it('should return false when ATTACHMENTS_ENABLED is "0"', () => {
      jest.spyOn(configService, 'get').mockReturnValue('0');
      expect(service.isEnabled).toBe(false);
    });

    it('should return false when ATTACHMENTS_ENABLED is undefined', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      expect(service.isEnabled).toBe(false);
    });

    it('should return false when ATTACHMENTS_ENABLED is empty string', () => {
      jest.spyOn(configService, 'get').mockReturnValue('');
      expect(service.isEnabled).toBe(false);
    });
  });

  describe('isDisabled', () => {
    it('should return false when attachments are enabled', () => {
      jest.spyOn(configService, 'get').mockReturnValue('true');
      expect(service.isDisabled).toBe(false);
    });

    it('should return true when attachments are disabled', () => {
      jest.spyOn(configService, 'get').mockReturnValue('false');
      expect(service.isDisabled).toBe(true);
    });
  });
});
