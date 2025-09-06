import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AttachmentsConfigService } from '../attachments-config.service';
import { ConfigInjectorInterceptor } from './config-injector.interceptor';

describe('ConfigInjectorInterceptor', () => {
  let interceptor: ConfigInjectorInterceptor;
  let attachmentsConfigService: AttachmentsConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigInjectorInterceptor,
        {
          provide: AttachmentsConfigService,
          useValue: {
            isEnabled: true,
          },
        },
      ],
    }).compile();

    interceptor = module.get<ConfigInjectorInterceptor>(
      ConfigInjectorInterceptor,
    );
    attachmentsConfigService = module.get<AttachmentsConfigService>(
      AttachmentsConfigService,
    );
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should inject attachmentsConfigService into request body', () => {
    const mockRequest = {
      body: { test: 'data' },
    };

    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of('test'),
    } as CallHandler;

    interceptor.intercept(mockExecutionContext, mockCallHandler);

    expect((mockRequest.body as any).attachmentsConfigService).toBe(
      attachmentsConfigService,
    );
  });

  it('should handle request without body', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of('test'),
    } as CallHandler;

    expect(() =>
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    ).not.toThrow();
  });
});
