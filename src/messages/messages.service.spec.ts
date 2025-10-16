import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttachmentsService } from '../attachments/attachments.service';
import { Bucket } from '../entities/bucket.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from '../notifications/notifications.types';
import { PushNotificationOrchestratorService } from '../notifications/push-orchestrator.service';
import { PayloadMapperService } from '../payload-mapper/payload-mapper.service';
import { UsersService } from '../users/users.service';
import { UserSettingType } from '../entities/user-setting.entity';
import { CreateMessageDto, CreateMessageWithAttachmentDto } from './dto';
import { MessagesService } from './messages.service';
import { NotificationPostponeService } from '../notifications/notification-postpone.service';
import { MessageReminderService } from './message-reminder.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let messagesRepository: Repository<Message>;
  let notificationsRepository: Repository<Notification>;
  let bucketsRepository: Repository<Bucket>;
  let usersRepository: Repository<User>;
  let attachmentsService: AttachmentsService;
  let pushOrchestrator: PushNotificationOrchestratorService;
  let configService: ConfigService;
  let entityPermissionService: EntityPermissionService;
  let payloadMapperService: PayloadMapperService;

  const mockMessage: Partial<Message> = {
    id: 'msg-1',
    title: 'Test Message',
    subtitle: 'Test Subtitle',
    body: 'Test Body',
    bucketId: 'bucket-1',
    deliveryType: NotificationDeliveryType.NORMAL,
    attachments: [],
    attachmentUuids: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    bucket: {
      id: 'bucket-1',
      name: 'Test Bucket',
      icon: 'https://example.com/bucket-icon.png',
    } as any,
  };

  const mockBucket: Partial<Bucket> = {
    id: 'bucket-1',
    name: 'Test Bucket',
    icon: 'https://example.com/bucket-icon.png',
    user: { id: 'user-1' } as any,
    isPublic: false,
  };

  const mockUser: Partial<User> = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockCreateMessageDto: CreateMessageDto = {
    title: 'Test Message',
    bucketId: 'bucket-1',
    deliveryType: NotificationDeliveryType.NORMAL,
    attachments: [],
  };

  const mockFile = {
    fieldname: 'attachment',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    destination: '/tmp',
    filename: 'test.jpg',
    path: '/tmp/test.jpg',
    buffer: Buffer.from('test'),
    stream: null,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: UsersService,
          useValue: {
            getUserSetting: jest.fn(
              async (userId: string, type: UserSettingType) => {
                if (type === UserSettingType.Language) {
                  return { valueText: 'en-EN' } as any;
                }
                return null;
              },
            ),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            create: jest.fn().mockReturnValue(mockMessage),
            save: jest.fn().mockResolvedValue(mockMessage),
            find: jest.fn().mockResolvedValue([mockMessage]),
            findOne: jest.fn().mockResolvedValue(mockMessage),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[mockMessage], 1]),
              getOne: jest.fn().mockResolvedValue(mockMessage),
              getMany: jest.fn().mockResolvedValue([mockMessage]),
              getCount: jest.fn().mockResolvedValue(1),
            })),
          },
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(Bucket),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockBucket),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              leftJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(mockBucket),
            })),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([mockUser]),
            findOne: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: AttachmentsService,
          useValue: {
            uploadAttachment: jest.fn().mockResolvedValue({
              id: 'att-1',
              filename: 'test.jpg',
              mediaType: MediaType.IMAGE,
            }),
            linkAttachmentToMessage: jest.fn().mockResolvedValue(undefined),
            downloadAndSaveFromUrl: jest.fn().mockResolvedValue({
              id: 'att-1',
              filename: 'downloaded.jpg',
              mediaType: MediaType.IMAGE,
            }),
            isAttachmentsEnabled: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PushNotificationOrchestratorService,
          useValue: {
            create: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('0'),
          },
        },
        {
          provide: EventTrackingService,
          useValue: {
            trackMessage: jest.fn(),
          },
        },
        {
          provide: EntityPermissionService,
          useValue: {
            hasPermissions: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PayloadMapperService,
          useValue: {
            transformPayload: jest.fn().mockResolvedValue({
              title: 'Test Message',
              subtitle: 'Test Subtitle',
              body: 'Test Body',
              deliveryType: NotificationDeliveryType.NORMAL,
              bucketId: 'bucket-1',
            }),
          },
        },
        {
          provide: ServerSettingsService,
          useValue: {
            getSettingByType: jest.fn().mockResolvedValue({
              valueText: '7d',
            }),
          },
        },
        {
          provide: NotificationPostponeService,
          useValue: {
            postponeNotification: jest.fn(),
            cancelPostpone: jest.fn(),
            getPostponedNotifications: jest.fn(),
            hasPendingPostpones: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: MessageReminderService,
          useValue: {
            createReminder: jest.fn().mockResolvedValue(undefined),
            cancelRemindersByMessage: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    messagesRepository = module.get<Repository<Message>>(
      getRepositoryToken(Message),
    );
    notificationsRepository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    bucketsRepository = module.get<Repository<Bucket>>(
      getRepositoryToken(Bucket),
    );
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    attachmentsService = module.get<AttachmentsService>(AttachmentsService);
    pushOrchestrator = module.get<PushNotificationOrchestratorService>(
      PushNotificationOrchestratorService,
    );
    configService = module.get<ConfigService>(ConfigService);
    entityPermissionService = module.get<EntityPermissionService>(
      EntityPermissionService,
    );
    payloadMapperService =
      module.get<PayloadMapperService>(PayloadMapperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a message successfully', async () => {
      const result = await service.create(mockCreateMessageDto, 'user-1');

      expect(bucketsRepository.createQueryBuilder).toHaveBeenCalled();
      expect(messagesRepository.create).toHaveBeenCalledWith({
        ...mockCreateMessageDto,
        bucketId: 'bucket-1', // Should use the actual bucket ID
        attachments: [], // No automatic bucket icon attachment anymore
        attachmentUuids: [],
      });
      expect(messagesRepository.save).toHaveBeenCalled();
      expect(pushOrchestrator.create).toHaveBeenCalled();
      expect(result).toEqual(mockMessage);
    });

    it('should create a message with userIds filter', async () => {
      const createMessageDtoWithUserIds: CreateMessageDto = {
        ...mockCreateMessageDto,
        userIds: ['user-1', 'user-2', 'user-3'],
      };

      // Mock users to be found
      const mockUsers = [
        { id: 'user-1', username: 'user1' } as User,
        { id: 'user-2', username: 'user2' } as User,
        { id: 'user-3', username: 'user3' } as User,
      ];
      jest.spyOn(usersRepository, 'find').mockResolvedValue(mockUsers);

      const result = await service.create(
        createMessageDtoWithUserIds,
        'user-1',
      );

      expect(bucketsRepository.createQueryBuilder).toHaveBeenCalled();
      expect(messagesRepository.create).toHaveBeenCalledWith({
        ...createMessageDtoWithUserIds,
        bucketId: 'bucket-1', // Should use the actual bucket ID
        attachments: [], // No automatic bucket icon attachment anymore
        attachmentUuids: [],
      });
      expect(messagesRepository.save).toHaveBeenCalled();
      expect(pushOrchestrator.create).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        ['user-1', 'user-2', 'user-3'],
        false,
      );
      expect(result).toEqual(mockMessage);
    });

    it('should create a message without userIds filter when not specified', async () => {
      const result = await service.create(mockCreateMessageDto, 'user-1');

      expect(pushOrchestrator.create).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [],
        false,
      );
      expect(result).toEqual(mockMessage);
    });

    it('should create a message with groupId and collapseId', async () => {
      const createMessageDtoWithGroupAndCollapse: CreateMessageDto = {
        ...mockCreateMessageDto,
        groupId: 'custom-group-123',
        collapseId: 'collapse-456',
      };

      const result = await service.create(
        createMessageDtoWithGroupAndCollapse,
        'user-1',
      );

      expect(messagesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createMessageDtoWithGroupAndCollapse,
          groupId: 'custom-group-123',
          collapseId: 'collapse-456',
          attachments: [], // No automatic bucket icon attachment anymore
        }),
      );
      expect(messagesRepository.save).toHaveBeenCalled();
      expect(pushOrchestrator.create).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [],
        false,
      );
      expect(result).toEqual(mockMessage);
    });

    it('should not add bucket icon when icon is not HTTP URL', async () => {
      // Mock bucket with non-HTTP icon
      const mockBucketWithEmojiIcon: Partial<Bucket> = {
        ...mockBucket,
        icon: '🚀', // Emoji icon
      };

      // Mock the createQueryBuilder to return our emoji bucket
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBucketWithEmojiIcon),
      };

      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.create(mockCreateMessageDto, 'user-1');

      expect(bucketsRepository.createQueryBuilder).toHaveBeenCalled();
      expect(messagesRepository.create).toHaveBeenCalledWith({
        ...mockCreateMessageDto,
        bucketId: 'bucket-1',
        attachments: [], // Should be empty, no icon added
        attachmentUuids: [],
      });
      expect(messagesRepository.save).toHaveBeenCalled();
      expect(pushOrchestrator.create).toHaveBeenCalled();
      expect(result).toEqual(mockMessage);
    });
  });

  describe('createWithAttachment', () => {
    it('should create a message with attachment successfully', async () => {
      const input: CreateMessageWithAttachmentDto = {
        bucketId: 'bucket-1',
        title: 'Test Message',
        deliveryType: NotificationDeliveryType.NORMAL,
        attachmentOptions: {
          name: 'test.jpg',
          mediaType: MediaType.IMAGE,
        },
      };

      const result = await service.createWithAttachment(
        input,
        'user-1',
        mockFile,
      );

      expect(bucketsRepository.createQueryBuilder).toHaveBeenCalled();
      expect(attachmentsService.uploadAttachment).toHaveBeenCalledWith(
        'user-1',
        {
          filename: 'test.jpg',
          mediaType: MediaType.IMAGE,
        },
        mockFile,
      );
      expect(messagesRepository.create).toHaveBeenCalled();
      expect(messagesRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockMessage);
    });
  });

  describe('findAll', () => {
    it('should return all messages', async () => {
      const result = await service.findAll();

      expect(messagesRepository.find).toHaveBeenCalledWith({
        relations: ['bucket'],
      });
      expect(result).toEqual([mockMessage]);
    });
  });

  describe('findOne', () => {
    it('should return a message by id', async () => {
      const result = await service.findOne('msg-1');

      expect(messagesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        relations: ['bucket', 'fileAttachments'],
      });
      expect(result).toEqual(mockMessage);
    });
  });

  describe('deleteMessagesFullyRead', () => {
    it('should delete fully read messages', async () => {
      const result = await service.deleteMessagesFullyRead();

      expect(messagesRepository.find).toHaveBeenCalled();
      expect(notificationsRepository.delete).toHaveBeenCalled();
      expect(result).toEqual({ deletedMessages: 1 });
    });
  });

  describe('findBucketByIdOrName', () => {
    it('should find bucket by ID when user owns it', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBucket),
      };
      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      // Use a valid UUID format
      const validUuid = 'c593ab42-92ff-409c-8bbf-3df51360aedc';
      const result = await service['findBucketByIdOrName'](validUuid, 'user-1');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'bucket.id = :bucketId AND (bucket.userId = :userId OR bucket.isPublic = true OR ep.id IS NOT NULL)',
        { bucketId: validUuid, userId: 'user-1' },
      );
      expect(result).toEqual(mockBucket);
    });

    it('should find bucket by name when user owns it', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBucket),
      };
      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service['findBucketByIdOrName'](
        'Test Bucket',
        'user-1',
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'bucket.name = :bucketName AND (bucket.userId = :userId OR bucket.isPublic = true OR ep.id IS NOT NULL)',
        { bucketName: 'Test Bucket', userId: 'user-1' },
      );
      expect(result).toEqual(mockBucket);
    });

    it('should find public bucket by name', async () => {
      const publicBucket = {
        ...mockBucket,
        isPublic: true,
        user: { id: 'user-2' },
      };
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(publicBucket),
      };
      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service['findBucketByIdOrName'](
        'Public Bucket',
        'user-1',
      );

      expect(result).toEqual(publicBucket);
    });

    it('should throw NotFoundException when bucket not found', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await expect(
        service['findBucketByIdOrName']('nonexistent', 'user-1'),
      ).rejects.toThrow(
        "Bucket with ID or name 'nonexistent' not found or you do not have access to it",
      );
    });
  });

  describe('findUsersByIdsOrUsernames', () => {
    it('should find users by IDs', async () => {
      const mockUsers = [
        { id: '550e8400-e29b-41d4-a716-446655440000', username: 'user1' },
        { id: '550e8400-e29b-41d4-a716-446655440001', username: 'user2' },
      ];
      jest.spyOn(usersRepository, 'find').mockResolvedValue(mockUsers as any);

      const result = await service['findUsersByIdsOrUsernames']([
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ]);

      expect(usersRepository.find).toHaveBeenCalledWith({
        where: {
          id: In([
            '550e8400-e29b-41d4-a716-446655440000',
            '550e8400-e29b-41d4-a716-446655440001',
          ]),
        },
      });
      expect(result).toEqual(mockUsers);
    });

    it('should find users by usernames when IDs not found', async () => {
      const mockUsersById = [
        { id: '550e8400-e29b-41d4-a716-446655440000', username: 'user1' },
      ];
      const mockUsersByUsername = [
        { id: '550e8400-e29b-41d4-a716-446655440001', username: 'user2' },
      ];

      jest
        .spyOn(usersRepository, 'find')
        .mockResolvedValueOnce(mockUsersById as any)
        .mockResolvedValueOnce(mockUsersByUsername as any);

      const result = await service['findUsersByIdsOrUsernames']([
        '550e8400-e29b-41d4-a716-446655440000', // valid UUID
        'user2', // username
      ]);

      expect(usersRepository.find).toHaveBeenCalledTimes(2);
      expect(usersRepository.find).toHaveBeenNthCalledWith(1, {
        where: { id: In(['550e8400-e29b-41d4-a716-446655440000']) },
      });
      expect(usersRepository.find).toHaveBeenNthCalledWith(2, {
        where: { username: In(['user2']) },
      });
      expect(result).toEqual([...mockUsersById, ...mockUsersByUsername]);
    });

    it('should throw NotFoundException when users not found', async () => {
      jest.spyOn(usersRepository, 'find').mockResolvedValue([]);

      await expect(
        service['findUsersByIdsOrUsernames'](['nonexistent']),
      ).rejects.toThrow('Users with IDs or usernames not found: nonexistent');
    });

    it('should return empty array when no userIds provided', async () => {
      const result = await service['findUsersByIdsOrUsernames']([]);
      expect(result).toEqual([]);
    });

    it('should find users with mixed IDs and usernames', async () => {
      const mockUsersById = [
        { id: '550e8400-e29b-41d4-a716-446655440000', username: 'user1' },
      ];
      const mockUsersByUsername = [
        { id: '550e8400-e29b-41d4-a716-446655440001', username: 'user2' },
      ];

      jest
        .spyOn(usersRepository, 'find')
        .mockResolvedValueOnce(mockUsersById as any)
        .mockResolvedValueOnce(mockUsersByUsername as any);

      const result = await service['findUsersByIdsOrUsernames']([
        '550e8400-e29b-41d4-a716-446655440000', // ID (valid UUID format)
        'user2', // username
      ]);

      expect(usersRepository.find).toHaveBeenCalledTimes(2);
      expect(usersRepository.find).toHaveBeenNthCalledWith(1, {
        where: { id: In(['550e8400-e29b-41d4-a716-446655440000']) },
      });
      expect(usersRepository.find).toHaveBeenNthCalledWith(2, {
        where: { username: In(['user2']) },
      });
      expect(result).toEqual([...mockUsersById, ...mockUsersByUsername]);
    });

    it('should only search by username for non-UUID identifiers', async () => {
      const mockUsersByUsername = [
        { id: '550e8400-e29b-41d4-a716-446655440000', username: 'user2' },
        { id: '550e8400-e29b-41d4-a716-446655440001', username: 'john_doe' },
      ];

      jest
        .spyOn(usersRepository, 'find')
        .mockResolvedValueOnce(mockUsersByUsername as any);

      const result = await service['findUsersByIdsOrUsernames']([
        'user2', // username (not UUID)
        'john_doe', // username (not UUID)
      ]);

      expect(usersRepository.find).toHaveBeenCalledTimes(1);
      expect(usersRepository.find).toHaveBeenCalledWith({
        where: { username: In(['user2', 'john_doe']) },
      });
      expect(result).toEqual(mockUsersByUsername);
    });
  });

  describe('create with bucketId/name and userIds/usernames', () => {
    it('should create message with bucket name instead of ID', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBucket),
      };
      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const createMessageDto = {
        ...mockCreateMessageDto,
        bucketId: 'Test Bucket', // Using name instead of ID
      };

      const result = await service.create(createMessageDto, 'user-1');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'bucket.name = :bucketName AND (bucket.userId = :userId OR bucket.isPublic = true OR ep.id IS NOT NULL)',
        { bucketName: 'Test Bucket', userId: 'user-1' },
      );
      expect(messagesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bucketId: 'bucket-1', // Should use the actual bucket ID
        }),
      );
      expect(result).toEqual(mockMessage);
    });

    it('should create message with user usernames instead of IDs', async () => {
      const mockUsers = [
        { id: '550e8400-e29b-41d4-a716-446655440000', username: 'user2' },
        { id: '550e8400-e29b-41d4-a716-446655440001', username: 'user3' },
      ];
      jest
        .spyOn(usersRepository, 'find')
        .mockResolvedValueOnce(mockUsers as any); // Found by username

      const createMessageDto = {
        ...mockCreateMessageDto,
        userIds: ['user2', 'user3'], // Using usernames instead of IDs
      };

      const result = await service.create(createMessageDto, 'user-1');

      expect(pushOrchestrator.create).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
        ], // Should use actual user IDs
        false,
      );
      expect(result).toEqual(mockMessage);
    });

    it('should create message with mixed bucket ID/name and user ID/username', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBucket),
      };
      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const mockUsers = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          username: 'user2',
        } as User,
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          username: 'user3',
        } as User,
      ];
      jest
        .spyOn(usersRepository, 'find')
        .mockResolvedValueOnce([
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            username: 'user2',
          } as User,
        ]) // Found by ID
        .mockResolvedValueOnce([
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            username: 'user3',
          } as User,
        ]); // Found by username

      const createMessageDto = {
        ...mockCreateMessageDto,
        bucketId: 'Test Bucket', // Using name
        userIds: ['550e8400-e29b-41d4-a716-446655440000', 'user3'], // Mixed ID and username
      };

      const result = await service.create(createMessageDto, 'user-1');

      expect(messagesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bucketId: 'bucket-1', // Should use the actual bucket ID
        }),
      );
      expect(pushOrchestrator.create).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
        ], // Should use actual user IDs
        false,
      );
      expect(result).toEqual(mockMessage);
    });
  });

  describe('Quick URL Features', () => {
    describe('URL Attachments (imageUrl, videoUrl, gifUrl)', () => {
      it('should create image attachment from imageUrl', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          imageUrl: 'https://example.com/image.jpg',
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                mediaType: MediaType.IMAGE,
                url: 'https://example.com/image.jpg',
                saveOnServer: false,
              }),
            ]),
          }),
        );
        expect(result).toEqual(mockMessage);
      });

      it('should create video attachment from videoUrl', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          videoUrl: 'https://example.com/video.mp4',
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                mediaType: MediaType.VIDEO,
                url: 'https://example.com/video.mp4',
                saveOnServer: false,
              }),
            ]),
          }),
        );
        expect(result).toEqual(mockMessage);
      });

      it('should create GIF attachment from gifUrl', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          gifUrl: 'https://example.com/animation.gif',
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                mediaType: MediaType.GIF,
                url: 'https://example.com/animation.gif',
                saveOnServer: false,
              }),
            ]),
          }),
        );
        expect(result).toEqual(mockMessage);
      });

      it('should create multiple attachments when multiple URLs are provided', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          imageUrl: 'https://example.com/image.jpg',
          videoUrl: 'https://example.com/video.mp4',
          gifUrl: 'https://example.com/animation.gif',
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                mediaType: MediaType.IMAGE,
                url: 'https://example.com/image.jpg',
                saveOnServer: false,
              }),
              expect.objectContaining({
                mediaType: MediaType.VIDEO,
                url: 'https://example.com/video.mp4',
                saveOnServer: false,
              }),
              expect.objectContaining({
                mediaType: MediaType.GIF,
                url: 'https://example.com/animation.gif',
                saveOnServer: false,
              }),
            ]),
          }),
        );
        expect(result).toEqual(mockMessage);
      });

      it('should work without any URL parameters', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: [], // No automatic bucket icon attachment anymore
          }),
        );
        expect(result).toEqual(mockMessage);
      });

      it('should combine URL attachments with existing attachments', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          imageUrl: 'https://example.com/image.jpg',
          attachments: [
            {
              mediaType: MediaType.AUDIO,
              url: 'https://example.com/audio.mp3',
              name: 'Audio File',
              saveOnServer: false,
            },
          ],
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                mediaType: MediaType.IMAGE,
                url: 'https://example.com/image.jpg',
                saveOnServer: false,
              }),
              expect.objectContaining({
                mediaType: MediaType.AUDIO,
                url: 'https://example.com/audio.mp3',
                name: 'Audio File',
                saveOnServer: false,
              }),
            ]),
          }),
        );
        expect(result).toEqual(mockMessage);
      });
    });

    describe('Tap URL Feature (tapUrl)', () => {
      it('should set tapAction to NAVIGATE when tapUrl is provided', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          tapUrl: 'https://example.com/navigate-here',
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tapAction: {
              type: NotificationActionType.NAVIGATE,
              value: 'https://example.com/navigate-here',
            },
          }),
        );
        expect(result).toEqual(mockMessage);
      });

      it('should not override existing tapAction when tapUrl is not provided', async () => {
        const existingTapAction = {
          type: NotificationActionType.OPEN_NOTIFICATION,
          value: 'notification-id-123',
        };

        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          tapAction: existingTapAction,
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tapAction: existingTapAction,
          }),
        );
        expect(result).toEqual(mockMessage);
      });

      it('should override existing tapAction when tapUrl is provided', async () => {
        const existingTapAction = {
          type: NotificationActionType.OPEN_NOTIFICATION,
          value: 'notification-id-123',
        };

        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          tapAction: existingTapAction,
          tapUrl: 'https://example.com/navigate-here',
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tapAction: {
              type: NotificationActionType.NAVIGATE,
              value: 'https://example.com/navigate-here',
            },
          }),
        );
        expect(result).toEqual(mockMessage);
      });

      it('should work without tapUrl parameter', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tapAction: undefined,
          }),
        );
        expect(result).toEqual(mockMessage);
      });
    });

    describe('Combined Quick Features', () => {
      it('should work with all quick features together', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message with all features',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          imageUrl: 'https://example.com/image.jpg',
          videoUrl: 'https://example.com/video.mp4',
          gifUrl: 'https://example.com/animation.gif',
          tapUrl: 'https://example.com/navigate-here',
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                mediaType: MediaType.IMAGE,
                url: 'https://example.com/image.jpg',
                saveOnServer: false,
              }),
              expect.objectContaining({
                mediaType: MediaType.VIDEO,
                url: 'https://example.com/video.mp4',
                saveOnServer: false,
              }),
              expect.objectContaining({
                mediaType: MediaType.GIF,
                url: 'https://example.com/animation.gif',
                saveOnServer: false,
              }),
            ]),
            tapAction: {
              type: NotificationActionType.NAVIGATE,
              value: 'https://example.com/navigate-here',
            },
          }),
        );
        expect(result).toEqual(mockMessage);
      });

      it('should work with quick features and existing attachments/actions', async () => {
        const createMessageDto: CreateMessageDto = {
          title: 'Test Message with mixed features',
          bucketId: 'bucket-1',
          deliveryType: NotificationDeliveryType.NORMAL,
          imageUrl: 'https://example.com/image.jpg',
          tapUrl: 'https://example.com/navigate-here',
          attachments: [
            {
              mediaType: MediaType.AUDIO,
              url: 'https://example.com/audio.mp3',
              name: 'Audio File',
              saveOnServer: false,
            },
          ],
          actions: [
            {
              type: NotificationActionType.MARK_AS_READ,
              value: 'mark-read',
            },
          ],
        };

        const result = await service.create(createMessageDto, 'user-1');

        expect(messagesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                mediaType: MediaType.IMAGE,
                url: 'https://example.com/image.jpg',
                saveOnServer: false,
              }),
              expect.objectContaining({
                mediaType: MediaType.AUDIO,
                url: 'https://example.com/audio.mp3',
                name: 'Audio File',
                saveOnServer: false,
              }),
            ]),
            actions: [
              {
                type: NotificationActionType.MARK_AS_READ,
                value: 'mark-read',
              },
            ],
            tapAction: {
              type: NotificationActionType.NAVIGATE,
              value: 'https://example.com/navigate-here',
            },
          }),
        );
        expect(result).toEqual(mockMessage);
      });
    });
  });

  describe('attachments validation', () => {
    it('should throw BadRequestException when saveOnServer is true but attachments are disabled', async () => {
      // Mock attachments service to return disabled
      jest.spyOn(attachmentsService, 'isAttachmentsEnabled').mockResolvedValue(false);

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Test Message',
        body: 'Test Body',
        deliveryType: NotificationDeliveryType.NORMAL,
        attachments: [
          {
            mediaType: MediaType.IMAGE,
            url: 'https://example.com/image.jpg',
            saveOnServer: true,
          },
        ],
      };

      await expect(service.create(createMessageDto, 'user-1')).rejects.toThrow(
        'Attachments are currently disabled, cannot save to server',
      );
    });

    it('should proceed normally when saveOnServer is true and attachments are enabled', async () => {
      // Mock attachments service to return enabled
      jest.spyOn(attachmentsService, 'isAttachmentsEnabled').mockResolvedValue(true);

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Test Message',
        body: 'Test Body',
        deliveryType: NotificationDeliveryType.NORMAL,
        attachments: [
          {
            mediaType: MediaType.IMAGE,
            url: 'https://example.com/image.jpg',
            saveOnServer: true,
          },
        ],
      };

      // Mock the bucket lookup
      jest.spyOn(bucketsRepository, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBucket),
      } as any);

      // Mock the message creation
      jest
        .spyOn(messagesRepository, 'create')
        .mockReturnValue(mockMessage as any);
      jest
        .spyOn(messagesRepository, 'save')
        .mockResolvedValue(mockMessage as Message);

      const result = await service.create(createMessageDto, 'user-1');
      expect(result).toEqual(mockMessage);
    });

    it('should proceed normally when saveOnServer is false regardless of attachments setting', async () => {
      // Mock config service to return attachments disabled
      jest.spyOn(configService, 'get').mockReturnValue('false');

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Test Message',
        body: 'Test Body',
        deliveryType: NotificationDeliveryType.NORMAL,
        attachments: [
          {
            mediaType: MediaType.IMAGE,
            url: 'https://example.com/image.jpg',
            saveOnServer: false,
          },
        ],
      };

      // Mock the bucket lookup
      jest.spyOn(bucketsRepository, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBucket),
      } as any);

      // Mock the message creation
      jest
        .spyOn(messagesRepository, 'create')
        .mockReturnValue(mockMessage as any);
      jest
        .spyOn(messagesRepository, 'save')
        .mockResolvedValue(mockMessage as Message);

      const result = await service.create(createMessageDto, 'user-1');
      expect(result).toEqual(mockMessage);
    });

    it('should proceed normally when no attachments are provided', async () => {
      // Mock config service to return attachments disabled
      jest.spyOn(configService, 'get').mockReturnValue('false');

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Test Message',
        body: 'Test Body',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      // Mock the bucket lookup
      jest.spyOn(bucketsRepository, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBucket),
      } as any);

      // Mock the message creation
      jest
        .spyOn(messagesRepository, 'create')
        .mockReturnValue(mockMessage as any);
      jest
        .spyOn(messagesRepository, 'save')
        .mockResolvedValue(mockMessage as Message);

      const result = await service.create(createMessageDto, 'user-1');
      expect(result).toEqual(mockMessage);
    });

    it('should proceed normally when attachments array is empty', async () => {
      // Mock config service to return attachments disabled
      jest.spyOn(configService, 'get').mockReturnValue('false');

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Test Message',
        body: 'Test Body',
        deliveryType: NotificationDeliveryType.NORMAL,
        attachments: [],
      };

      // Mock the bucket lookup
      jest.spyOn(bucketsRepository, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBucket),
      } as any);

      // Mock the message creation
      jest
        .spyOn(messagesRepository, 'create')
        .mockReturnValue(mockMessage as any);
      jest
        .spyOn(messagesRepository, 'save')
        .mockResolvedValue(mockMessage as Message);

      const result = await service.create(createMessageDto, 'user-1');
      expect(result).toEqual(mockMessage);
    });
  });
});
