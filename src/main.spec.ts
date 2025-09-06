import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

describe('ValidationPipe Configuration', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [],
    }).compile();

    app = module.createNestApplication();
  });

  it('should configure ValidationPipe with custom exceptionFactory', () => {
    const validationPipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const result = errors.map((error) => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints,
        }));
        return new BadRequestException({
          message: 'Validation failed',
          errors: result,
        });
      },
    });

    expect(validationPipe).toBeDefined();
    expect(validationPipe).toBeInstanceOf(ValidationPipe);
  });

  it('should create BadRequestException with detailed error information', () => {
    const mockErrors = [
      {
        property: 'title',
        value: '',
        constraints: { isNotEmpty: 'title should not be empty' },
      },
      {
        property: 'bucketId',
        value: null,
        constraints: { isString: 'bucketId must be a string' },
      },
    ];

    const validationPipe = new ValidationPipe({
      exceptionFactory: (errors) => {
        const result = errors.map((error) => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints,
        }));
        return new BadRequestException({
          message: 'Validation failed',
          errors: result,
        });
      },
    });

    const exception = validationPipe['exceptionFactory'](mockErrors as any);

    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getResponse()).toEqual({
      message: 'Validation failed',
      errors: [
        {
          property: 'title',
          value: '',
          constraints: { isNotEmpty: 'title should not be empty' },
        },
        {
          property: 'bucketId',
          value: null,
          constraints: { isString: 'bucketId must be a string' },
        },
      ],
    });
  });
});
