import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AttachmentsDisabledGuard } from '../attachments/attachments-disabled.guard';
import { AccessTokenService } from '../auth/access-token.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { MagicCodeGuard } from '../auth/guards/magic-code.guard';
import { BucketsService } from '../buckets/buckets.service';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { Message } from '../entities/message.entity';
import { UserAccessToken } from '../entities/user-access-token.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { CreateMessageDto, CreateMessageWithAttachmentDto } from './dto';
import { MessagesRootController } from './messages.root.controller';
import { MessagesStreamService } from './messages-stream.service';
import { MessagesService } from './messages.service';

describe('MessagesRootController', () => {
  let controller: MessagesRootController;
  let messagesService: MessagesService;

  const mockMessage: Partial<Message> = {
    id: 'message-1',
    title: 'Test Message',
    body: 'Test Body',
    bucketId: 'bucket-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateResult = {
    message: mockMessage as Message,
    notificationsCount: 0,
  };

  const mockMessagesService = {
    create: jest.fn(),
    createWithAttachment: jest.fn(),
    transformAndCreate: jest.fn(),
    applyTemplate: jest.fn(),
  };

  const mockAttachmentsDisabledGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockAccessTokenService = {
    validateAccessToken: jest.fn(),
  };

  const mockUserAccessTokenRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserBucketRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockGraphQLSubscriptionService = {
    messageCreated: jest.fn().mockReturnValue({ [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: null, done: true }) }) }),
  };

  const mockMessagesStreamService = {
    getEvents: jest.fn().mockReturnValue([]),
    waitForNext: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesRootController],
      providers: [
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: GraphQLSubscriptionService,
          useValue: mockGraphQLSubscriptionService,
        },
        {
          provide: MessagesStreamService,
          useValue: mockMessagesStreamService,
        },
        {
          provide: BucketsService,
          useValue: {
            calculateBucketPermissions: jest.fn().mockResolvedValue({ canWrite: true, canRead: true }),
            findOne: jest.fn().mockResolvedValue({ id: 'bucket-1', name: 'Test' }),
          },
        },
        {
          provide: AccessTokenService,
          useValue: mockAccessTokenService,
        },
        {
          provide: getRepositoryToken(UserAccessToken),
          useValue: mockUserAccessTokenRepository,
        },
        {
          provide: getRepositoryToken(UserBucket),
          useValue: mockUserBucketRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    })
      .overrideGuard(MagicCodeGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(AttachmentsDisabledGuard)
      .useValue(mockAttachmentsDisabledGuard)
      .compile();

    controller = module.get<MessagesRootController>(MessagesRootController);
    messagesService = module.get<MessagesService>(MessagesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a message successfully', async () => {
      const createMessageDto: CreateMessageWithAttachmentDto = {
        title: 'Test Message',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        attachments: [],
        attachmentOptions: undefined as any
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with uploaded attachment successfully', async () => {
      const createMessageWithAttachmentDto: CreateMessageWithAttachmentDto = {
        title: 'Test Message with Upload',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        attachmentOptions: {
          name: 'custom-filename.jpg',
          mediaType: 'IMAGE' as any,
        },
      };

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-image.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: '/tmp',
        filename: 'test-image.jpg',
        path: '/tmp/test-image.jpg',
        buffer: Buffer.from('test'),
        stream: {} as any,
      };

      mockMessagesService.createWithAttachment.mockResolvedValue(mockCreateResult);

      const result = await controller.create(
        'user-1',
        createMessageWithAttachmentDto,
        mockFile,
      );

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.createWithAttachment).toHaveBeenCalledWith(
        createMessageWithAttachmentDto,
        'user-1',
        mockFile,
      );
    });
  });

  describe('sendMessage (GET endpoint)', () => {
    it('should send message via GET', async () => {
      const queryParams = {
        title: 'Test GET Message',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
      };

      const expectedCreateMessageDto: CreateMessageDto = {
        title: 'Test GET Message',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.sendMessage('user-1', queryParams as any);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        expectedCreateMessageDto,
        'user-1',
      );
    });
  });

  describe('transformAndCreate', () => {
    it('should transform and create message', async () => {
      const parserName = 'test-parser';
      const bucketId = 'bucket-1';
      const payload = { foo: 'bar' };
      const userId = 'user-1';

      mockMessagesService.transformAndCreate.mockResolvedValue(mockCreateResult);

      const result = await controller.transformAndCreate(
        userId,
        parserName,
        bucketId,
        '',
        payload,
        {},
        { method: 'POST', url: '/transform' }
      );

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.transformAndCreate).toHaveBeenCalledWith(
        parserName,
        payload,
        userId,
        bucketId,
        {}
      );
    });
  });

  describe('createFromTemplate', () => {
    it('should create message from template', async () => {
      const template = 'test-template';
      const bucketId = 'bucket-1';
      const templateData = { name: 'World' };
      const userId = 'user-1';

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.createFromTemplate(
        userId,
        template,
        bucketId,
        '',
        templateData,
        {},
        {}
      );

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.applyTemplate).toHaveBeenCalled();
      expect(messagesService.create).toHaveBeenCalled();
    });
  });
});
