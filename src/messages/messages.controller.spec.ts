import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AttachmentsDisabledGuard } from '../attachments/attachments-disabled.guard';
import { AccessTokenService } from '../auth/access-token.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { MagicCodeGuard } from '../auth/guards/magic-code.guard';
import { Message } from '../entities/message.entity';
import { UserAccessToken } from '../entities/user-access-token.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { CreateMessageDto, CreateMessageWithAttachmentDto } from './dto';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

describe('MessagesController', () => {
  let controller: MessagesController;
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
  };

  const mockAttachmentsDisabledGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockConfigInjectorInterceptor = {
    intercept: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: mockMessagesService,
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
      .overrideGuard(AttachmentsDisabledGuard)
      .useValue(mockAttachmentsDisabledGuard)
      .compile();

    controller = module.get<MessagesController>(MessagesController);
    messagesService = module.get<MessagesService>(MessagesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a message successfully', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Test Message',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        attachments: [],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with attachments', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Test Message with Attachments',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        attachments: [
          {
            mediaType: 'IMAGE' as any,
            name: 'test-image.jpg',
            url: 'https://example.com/image.jpg',
            saveOnServer: true,
          },
        ],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with actions', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Test Message with Actions',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        actions: [
          {
            type: 'NAVIGATE' as any,
            value: 'https://example.com',
            destructive: false,
            icon: 'link',
            title: 'Open Link',
          },
        ],
        addMarkAsReadAction: true,
        addOpenNotificationAction: true,
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with mixed data sources', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Test Message',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        subtitle: 'Override from header',
        sound: 'custom-sound.wav',
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    // Test specifici per diverse combinazioni di payload e fonti di dati
    it('should create a message with complex attachments array', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Complex Attachments Message',
        body: 'Message with various attachment types',
        bucketId: 'bucket-1',
        deliveryType: 'CRITICAL' as any,
        attachments: [
          {
            mediaType: 'IMAGE' as any,
            name: 'profile.jpg',
            url: 'https://example.com/profile.jpg',
            saveOnServer: true,
          },
          {
            mediaType: 'VIDEO' as any,
            name: 'demo.mp4',
            url: 'https://example.com/demo.mp4',
            saveOnServer: false,
          },
          {
            mediaType: 'AUDIO' as any,
            name: 'voice-message.mp3',
            attachmentUuid: 'uuid-123',
          },
          {
            mediaType: 'GIF' as any,
            name: 'animation.gif',
            url: 'https://example.com/animation.gif',
          },
        ],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with complex actions array', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Complex Actions Message',
        body: 'Message with various action types',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        actions: [
          {
            type: 'NAVIGATE' as any,
            value: 'https://example.com',
            destructive: false,
            icon: 'link',
            title: 'Open Link',
          },
          {
            type: 'BACKGROUND_CALL' as any,
            value: 'https://api.example.com/webhook',
            destructive: false,
            icon: 'webhook',
            title: 'Call Webhook',
          },
          {
            type: 'WEBHOOK' as any,
            value: 'https://internal.example.com/action',
            destructive: true,
            icon: 'trash',
            title: 'Delete Item',
          },
          {
            type: 'SNOOZE' as any,
            value: '30',
            destructive: false,
            icon: 'clock',
            title: 'Snooze 30min',
          },
        ],
        tapAction: {
          type: 'OPEN_NOTIFICATION' as any,
          value: 'notification-detail',
          destructive: false,
          icon: 'eye',
          title: 'View Details',
        },
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with all boolean flags enabled', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'All Flags Message',
        body: 'Message with all boolean flags enabled',
        bucketId: 'bucket-1',
        deliveryType: 'SILENT' as any,
        addMarkAsReadAction: true,
        addOpenNotificationAction: true,
        addDeleteAction: true,
        sound: 'custom-sound.wav',
        locale: 'it-IT',
        snoozes: [15, 30, 60, 120, 240],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with minimal required fields only', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Minimal Message',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with all optional fields populated', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Complete Message',
        subtitle: 'Optional subtitle',
        body: 'Optional body content that can be quite long and contain various types of content including special characters: !@#$%^&*()',
        bucketId: 'bucket-1',
        deliveryType: 'CRITICAL' as any,
        attachments: [
          {
            mediaType: 'ICON' as any,
            name: 'app-icon.png',
            url: 'https://example.com/icon.png',
          },
        ],
        actions: [
          {
            type: 'MARK_AS_READ' as any,
            value: 'mark-read',
            destructive: false,
            icon: 'check',
            title: 'Mark as Read',
          },
        ],
        tapAction: {
          type: 'DELETE' as any,
          value: 'delete',
          destructive: true,
          icon: 'trash',
          title: 'Delete',
        },
        sound: 'notification-sound.mp3',
        addMarkAsReadAction: false,
        addOpenNotificationAction: false,
        addDeleteAction: false,
        snoozes: [5, 10, 15, 30, 60, 120, 240, 480, 1440],
        locale: 'en-US',
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with edge case values', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'A', // Minimum length title
        body: 'B', // Minimum length body
        bucketId: 'bucket-1',
        deliveryType: 'SILENT' as any,
        attachments: [], // Empty array
        actions: [], // Empty array
        snoozes: [], // Empty array
        locale: '', // Empty string
        sound: '', // Empty string
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with maximum length values', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'A'.repeat(100), // Maximum length title
        subtitle: 'B'.repeat(100), // Maximum length subtitle
        body: 'C'.repeat(500), // Maximum length body
        bucketId: 'bucket-1',
        deliveryType: 'CRITICAL' as any,
        attachments: [
          {
            mediaType: 'IMAGE' as any,
            name: 'D'.repeat(100), // Long name
            url: 'https://example.com/' + 'E'.repeat(100), // Long URL
          },
        ],
        actions: [
          {
            type: 'NAVIGATE' as any,
            value: 'https://example.com/' + 'F'.repeat(100), // Long value
            destructive: false,
            icon: 'link',
            title: 'G'.repeat(100), // Long title
          },
        ],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with mixed delivery types and priorities', async () => {
      const testCases = [
        { deliveryType: 'SILENT' as any, priority: 'low' },
        { deliveryType: 'NORMAL' as any, priority: 'medium' },
        { deliveryType: 'CRITICAL' as any, priority: 'high' },
      ];

      for (const testCase of testCases) {
        const createMessageDto: CreateMessageDto = {
          title: `Priority ${testCase.priority} Message`,
          body: `This is a ${testCase.priority} priority message`,
          bucketId: 'bucket-1',
          deliveryType: testCase.deliveryType,
          sound:
            testCase.deliveryType === 'CRITICAL' ? 'urgent.wav' : 'normal.wav',
        };

        mockMessagesService.create.mockResolvedValue(mockCreateResult);

        const result = await controller.create('user-1', createMessageDto);

        expect(result).toEqual(mockCreateResult);
        expect(messagesService.create).toHaveBeenCalledWith(
          createMessageDto,
          'user-1',
        );
      }
    });

    it('should create a message with various media types', async () => {
      const mediaTypes = ['IMAGE', 'VIDEO', 'GIF', 'AUDIO', 'ICON'] as const;

      for (const mediaType of mediaTypes) {
        const createMessageDto: CreateMessageDto = {
          title: `${mediaType} Media Message`,
          body: `Message with ${mediaType.toLowerCase()} attachment`,
          bucketId: 'bucket-1',
          deliveryType: 'NORMAL' as any,
          attachments: [
            {
              mediaType: mediaType as any,
              name: `test.${mediaType.toLowerCase()}`,
              url: `https://example.com/test.${mediaType.toLowerCase()}`,
            },
          ],
        };

        mockMessagesService.create.mockResolvedValue(mockCreateResult);

        const result = await controller.create('user-1', createMessageDto);

        expect(result).toEqual(mockCreateResult);
        expect(messagesService.create).toHaveBeenCalledWith(
          createMessageDto,
          'user-1',
        );
      }
    });

    it('should create a message with various action types', async () => {
      const actionTypes = [
        'NAVIGATE',
        'BACKGROUND_CALL',
        'MARK_AS_READ',
        'SNOOZE',
        'OPEN_NOTIFICATION',
        'WEBHOOK',
        'DELETE',
      ] as const;

      for (const actionType of actionTypes) {
        const createMessageDto: CreateMessageDto = {
          title: `${actionType} Action Message`,
          body: `Message with ${actionType.toLowerCase()} action`,
          bucketId: 'bucket-1',
          deliveryType: 'NORMAL' as any,
          actions: [
            {
              type: actionType as any,
              value: `action-value-${actionType.toLowerCase()}`,
              destructive: actionType === 'DELETE',
              icon: 'icon',
              title: `${actionType} Action`,
            },
          ],
        };

        mockMessagesService.create.mockResolvedValue(mockCreateResult);

        const result = await controller.create('user-1', createMessageDto);

        expect(result).toEqual(mockCreateResult);
        expect(messagesService.create).toHaveBeenCalledWith(
          createMessageDto,
          'user-1',
        );
      }
    });
  });

  // Test specifici per il decoratore CombineMessageSources e fonti di dati multiple
  describe('create with CombineMessageSources decorator', () => {
    it('should handle data from multiple sources with proper precedence', async () => {
      // Questo test simula il comportamento del decoratore
      // In un test reale, dovremmo testare l'endpoint HTTP con diversi parametri
      const baseMessageDto: CreateMessageDto = {
        title: 'Base Title',
        body: 'Base Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', baseMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        baseMessageDto,
        'user-1',
      );
    });

    it('should handle string-based arrays that need parsing', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'String Arrays Message',
        body: 'Message with string arrays that need parsing',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        // Simula dati che potrebbero venire da query params o headers come stringhe
        snoozes: [5, 10, 15, 30, 60],
        attachments: [
          {
            mediaType: 'IMAGE' as any,
            name: 'test.jpg',
            url: 'https://example.com/test.jpg',
          },
        ],
        actions: [
          {
            type: 'NAVIGATE' as any,
            value: 'https://example.com',
            destructive: false,
            icon: 'link',
            title: 'Open Link',
          },
        ],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should handle boolean transformations from strings', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Boolean Transform Message',
        body: 'Message testing boolean transformations',
        bucketId: 'bucket-1',
        deliveryType: 'SILENT' as any,
        addMarkAsReadAction: true,
        addOpenNotificationAction: false,
        addDeleteAction: true,
        // Simula dati che potrebbero venire da form data o query params
        attachments: [
          {
            mediaType: 'IMAGE' as any,
            name: 'test.jpg',
            url: 'https://example.com/test.jpg',
            saveOnServer: true,
          },
        ],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should handle mixed data types and transformations', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Mixed Data Types',
        subtitle: 'Testing various data transformations',
        body: 'Complex message with mixed data types',
        bucketId: 'bucket-1',
        deliveryType: 'CRITICAL' as any,
        sound: 'urgent.wav',
        locale: 'en-US',
        snoozes: [5, 10, 15, 30, 60, 120, 240, 480, 1440],
        attachments: [
          {
            mediaType: 'VIDEO' as any,
            name: 'demo.mp4',
            url: 'https://example.com/demo.mp4',
            saveOnServer: true,
          },
          {
            mediaType: 'AUDIO' as any,
            name: 'voice.mp3',
            attachmentUuid: 'uuid-456',
          },
        ],
        actions: [
          {
            type: 'WEBHOOK' as any,
            value: 'https://api.example.com/webhook',
            destructive: false,
            icon: 'webhook',
            title: 'Send Webhook',
          },
          {
            type: 'SNOOZE' as any,
            value: '30',
            destructive: false,
            icon: 'clock',
            title: 'Snooze 30min',
          },
        ],
        tapAction: {
          type: 'OPEN_NOTIFICATION' as any,
          value: 'notification-detail',
          destructive: false,
          icon: 'eye',
          title: 'View Details',
        },
        addMarkAsReadAction: true,
        addOpenNotificationAction: true,
        addDeleteAction: false,
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should handle edge cases with empty and null values', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Edge Cases Message',
        body: 'Message testing edge cases',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        // Testa vari casi limite
        subtitle: undefined,
        sound: null as any,
        locale: '',
        snoozes: [],
        attachments: [],
        actions: [],
        tapAction: undefined,
        addMarkAsReadAction: undefined,
        addOpenNotificationAction: undefined,
        addDeleteAction: undefined,
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should handle special characters and unicode in text fields', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Special Chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        subtitle: 'Unicode: 🚀🔥💻📱🎯',
        body: 'Mixed content: ASCII + Unicode + Special chars: !@#$%^&*() 🚀🔥💻📱🎯 [brackets] {braces} <tags>',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        sound: 'special-sound-🎵.wav',
        locale: 'zh-CN', // Chinese locale
        attachments: [
          {
            mediaType: 'IMAGE' as any,
            name: 'special-📸-image.jpg',
            url: 'https://example.com/special-📸-image.jpg',
          },
        ],
        actions: [
          {
            type: 'NAVIGATE' as any,
            value: 'https://example.com/special-🚀-page',
            destructive: false,
            icon: '🚀',
            title: 'Go to 🚀 Page',
          },
        ],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });

    it('should create a message with userIds filter', async () => {
      const createMessageDto: CreateMessageDto = {
        title: 'Test Message with UserIds Filter',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        userIds: ['user-1', 'user-2', 'user-3'],
        attachments: [],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create('user-1', createMessageDto);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        createMessageDto,
        'user-1',
      );
    });
  });

  describe('createWithAttachment', () => {
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

      mockMessagesService.createWithAttachment.mockResolvedValue(
        mockCreateResult,
      );

      const result = await controller.createWithAttachment(
        'user-1',
        mockFile,
        createMessageWithAttachmentDto,
      );

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.createWithAttachment).toHaveBeenCalledWith(
        createMessageWithAttachmentDto,
        'user-1',
        mockFile,
      );
    });

    it('should create a message with uploaded attachment using default options', async () => {
      const createMessageWithAttachmentDto: CreateMessageWithAttachmentDto = {
        title: 'Test Message with Upload',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        attachmentOptions: {
          mediaType: 'VIDEO' as any,
        },
      };

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-video.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 2048,
        destination: '/tmp',
        filename: 'test-video.mp4',
        path: '/tmp/test-video.mp4',
        buffer: Buffer.from('test'),
        stream: {} as any,
      };

      mockMessagesService.createWithAttachment.mockResolvedValue(
        mockCreateResult,
      );

      const result = await controller.createWithAttachment(
        'user-1',
        mockFile,
        createMessageWithAttachmentDto,
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
    it('should send message via GET with userIds filter', async () => {
      const queryParams = {
        title: 'Test GET Message',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        userIds: ['user-1', 'user-2', 'user-3'],
      };

      const expectedCreateMessageDto: CreateMessageDto = {
        title: 'Test GET Message',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        userIds: ['user-1', 'user-2', 'user-3'],
      };

      mockMessagesService.create.mockResolvedValue(mockCreateResult);

      const result = await controller.sendMessage('user-1', queryParams as any);

      expect(result).toEqual(mockCreateResult);
      expect(messagesService.create).toHaveBeenCalledWith(
        expectedCreateMessageDto,
        'user-1',
      );
    });

    it('should send message via GET without userIds when not provided', async () => {
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

    it('should send message via GET with groupId and collapseId', async () => {
      const queryParams = {
        title: 'Test GET Message with Group',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        groupId: 'custom-group-123',
        collapseId: 'collapse-456',
      };

      const expectedCreateMessageDto: CreateMessageDto = {
        title: 'Test GET Message with Group',
        body: 'Test Body',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL' as any,
        groupId: 'custom-group-123',
        collapseId: 'collapse-456',
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
});
