import { Test, TestingModule } from '@nestjs/testing';
import { JwtOrAccessTokenGuard } from '../../auth/guards/jwt-or-access-token.guard';
import { Message } from '../../entities/message.entity';
import {
  CreateMessageDto,
  MessagesQueryDto,
  MessagesResponseDto,
} from '../../messages/dto';
import { MessagesService } from '../../messages/messages.service';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from '../../notifications/notifications.types';
import { MessagesResolver } from './messages.resolver';

describe('MessagesResolver', () => {
  let resolver: MessagesResolver;
  let messagesService: MessagesService;

  const mockMessage: Partial<Message> = {
    id: 'message-1',
    title: 'Test Message',
    body: 'Test Body',
    bucketId: 'bucket-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deliveryType: NotificationDeliveryType.NORMAL,
    bucket: {
      id: 'bucket-1',
      name: 'Test Bucket',
    } as any,
  };

  const mockCreateMessageDto: CreateMessageDto = {
    title: 'Test Message',
    body: 'Test Body',
    bucketId: 'bucket-1',
    deliveryType: NotificationDeliveryType.NORMAL,
    attachments: [],
  };

  const mockMessagesQueryDto: MessagesQueryDto = {
    page: 1,
    limit: 20,
    search: 'test',
  };

  const mockMessagesResponseDto: MessagesResponseDto = {
    messages: [mockMessage as Message],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  const mockMessagesService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesResolver,
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    resolver = module.get<MessagesResolver>(MessagesResolver);
    messagesService = module.get<MessagesService>(MessagesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('createMessage', () => {
    it('should create a message successfully', async () => {
      mockMessagesService.create.mockResolvedValue(mockMessage as Message);

      const result = await resolver.createMessage(
        mockCreateMessageDto,
        'user-1',
      );

      expect(result).toEqual(mockMessage);
      expect(messagesService.create).toHaveBeenCalledWith(
        mockCreateMessageDto,
        'user-1',
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockMessagesService.create.mockRejectedValue(error);

      await expect(
        resolver.createMessage(mockCreateMessageDto, 'user-1'),
      ).rejects.toThrow('Service error');
      expect(messagesService.create).toHaveBeenCalledWith(
        mockCreateMessageDto,
        'user-1',
      );
    });

    it('should create message with attachments', async () => {
      const messageWithAttachments = {
        ...mockCreateMessageDto,
        attachments: [
          {
            mediaType: MediaType.IMAGE,
            name: 'test.jpg',
            url: 'https://example.com/test.jpg',
            saveOnServer: true,
          },
        ],
      };

      mockMessagesService.create.mockResolvedValue(mockMessage as Message);

      const result = await resolver.createMessage(
        messageWithAttachments,
        'user-1',
      );

      expect(result).toEqual(mockMessage);
      expect(messagesService.create).toHaveBeenCalledWith(
        messageWithAttachments,
        'user-1',
      );
    });

    it('should create message with actions', async () => {
      const messageWithActions = {
        ...mockCreateMessageDto,
        actions: [
          {
            type: NotificationActionType.NAVIGATE,
            value: 'https://example.com',
            destructive: false,
            icon: 'link',
            title: 'Open Link',
          },
        ],
      };

      mockMessagesService.create.mockResolvedValue(mockMessage as Message);

      const result = await resolver.createMessage(messageWithActions, 'user-1');

      expect(result).toEqual(mockMessage);
      expect(messagesService.create).toHaveBeenCalledWith(
        messageWithActions,
        'user-1',
      );
    });
  });
});
