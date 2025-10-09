import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsService } from './attachments.service';
import { AttachmentsDisabledGuard } from './attachments-disabled.guard';

describe('AttachmentsDisabledGuard', () => {
  let guard: AttachmentsDisabledGuard;
  let attachmentsService: AttachmentsService;

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
          provide: AttachmentsService,
          useValue: {
            isAttachmentsEnabled: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    guard = module.get<AttachmentsDisabledGuard>(AttachmentsDisabledGuard);
    attachmentsService = module.get<AttachmentsService>(AttachmentsService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when attachments are enabled', async () => {
    jest
      .spyOn(attachmentsService, 'isAttachmentsEnabled')
      .mockResolvedValue(true);

    const result = await guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when attachments are disabled', async () => {
    jest
      .spyOn(attachmentsService, 'isAttachmentsEnabled')
      .mockResolvedValue(false);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      'Attachments are currently disabled',
    );
  });
});
