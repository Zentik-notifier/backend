import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsConfigService } from './attachments-config.service';
import { AttachmentsDisabledGuard } from './attachments-disabled.guard';

describe('AttachmentsDisabledGuard', () => {
  let guard: AttachmentsDisabledGuard;
  let attachmentsConfigService: AttachmentsConfigService;

  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => ({}),
    }),
  } as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsDisabledGuard,
        {
          provide: AttachmentsConfigService,
          useValue: {
            get isDisabled() {
              return false;
            },
          },
        },
      ],
    }).compile();

    guard = module.get<AttachmentsDisabledGuard>(AttachmentsDisabledGuard);
    attachmentsConfigService = module.get<AttachmentsConfigService>(AttachmentsConfigService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when attachments are enabled', () => {
    Object.defineProperty(attachmentsConfigService, 'isDisabled', {
      get: jest.fn().mockReturnValue(false),
      configurable: true,
    });
    
    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when attachments are disabled', () => {
    Object.defineProperty(attachmentsConfigService, 'isDisabled', {
      get: jest.fn().mockReturnValue(true),
      configurable: true,
    });
    
    expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(mockExecutionContext)).toThrow('Attachments are currently disabled');
  });
});
