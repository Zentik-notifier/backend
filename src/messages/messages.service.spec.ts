import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttachmentsService } from '../attachments/attachments.service';
import { Bucket } from '../entities/bucket.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { UserBucket } from '../entities/user-bucket.entity';
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
import { UserSettingType } from '../entities/user-setting.types';
import { CreateMessageDto, CreateMessageWithAttachmentDto } from './dto';
import { MessagesService } from './messages.service';
import { NotificationPostponeService } from '../notifications/notification-postpone.service';
import { MessageReminderService } from './message-reminder.service';
import { UrlBuilderService } from '../common/services/url-builder.service';
import { UserTemplatesService } from './user-templates.service';
import { UserTemplate } from '../entities/user-template.entity';
import { EntityExecutionService } from '../entity-execution/entity-execution.service';
import { BucketsService } from '../buckets/buckets.service';
import { ExternalNotifyCredentialsStore } from '../external-notify-system/external-notify-credentials.store';

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
  let module: TestingModule;

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
    module = await Test.createTestingModule({
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
          provide: getRepositoryToken(UserBucket),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
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
            createNotificationsForMessage: jest
              .fn()
              .mockResolvedValue({ notifications: [], authorizedUsers: [] }),
            sendPushToDevices: jest.fn().mockResolvedValue({
              processedNotifications: [],
              successCount: 0,
              errorCount: 0,
              snoozedCount: 0,
              errors: [],
              iosSent: 0,
              androidSent: 0,
              webSent: 0,
            }),
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
        {
          provide: UserTemplatesService,
          useValue: {
            findByUserIdAndNameOrId: jest.fn(),
          },
        },
        {
          provide: EntityExecutionService,
          useValue: {
            create: jest.fn().mockResolvedValue({
              id: 'execution-1',
              type: 'MESSAGE_TEMPLATE',
              status: 'SUCCESS',
            }),
          },
        },
        {
          provide: BucketsService,
          useValue: {
            calculateBucketPermissions: jest.fn().mockResolvedValue({
              canWrite: true,
              canRead: true,
              canDelete: false,
              canAdmin: false,
              isOwner: false,
              isSharedWithMe: false,
              sharedCount: 0,
            }),
          },
        },
        {
          provide: UrlBuilderService,
          useValue: {
            buildAttachmentUrl: jest.fn().mockImplementation((id: string) => `/api/v1/attachments/${id}/download/public`),
            buildThumbnailUrl: jest.fn().mockImplementation((id: string) => `/api/v1/attachments/${id}/thumbnail?size=medium`),
            processNotifications: jest.fn().mockImplementation((x: any) => x),
            buildUrl: jest.fn().mockImplementation((p: string) => `/api/v1${p.startsWith('/')?p:`/${p}`}`),
          },
        },
        {
          provide: ExternalNotifyCredentialsStore,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
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
      expect(pushOrchestrator.createNotificationsForMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [],
      );
      expect(result.message).toEqual(mockMessage);
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
      expect(pushOrchestrator.createNotificationsForMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        ['user-1', 'user-2', 'user-3'],
      );
      expect(result.message).toEqual(mockMessage);
    });

    it('should create a message without userIds filter when not specified', async () => {
      const result = await service.create(mockCreateMessageDto, 'user-1');

      expect(pushOrchestrator.createNotificationsForMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [],
      );
      expect(result.message).toEqual(mockMessage);
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
      expect(pushOrchestrator.createNotificationsForMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [],
      );
      expect(result.message).toEqual(mockMessage);
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
      expect(pushOrchestrator.createNotificationsForMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [],
      );
      expect(result.message).toEqual(mockMessage);
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
      expect(result.message).toEqual(mockMessage);
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

      expect(messagesRepository.find).toHaveBeenCalledWith({
        relations: ['bucket'],
      });
      expect(notificationsRepository.delete).toHaveBeenCalled();
      expect(result).toEqual({ deletedMessages: 1 });
    });

    it('should not delete messages from protected buckets', async () => {
      const protectedBucket = {
        ...mockBucket,
        isProtected: true,
      };

      const messageInProtectedBucket = {
        ...mockMessage,
        bucket: protectedBucket,
      };

      jest.spyOn(messagesRepository, 'find').mockResolvedValueOnce([messageInProtectedBucket] as any);
      jest.spyOn(notificationsRepository, 'find').mockResolvedValueOnce([]);

      const result = await service.deleteMessagesFullyRead();

      expect(messagesRepository.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ deletedMessages: 0 });
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
      expect(result.message).toEqual(mockMessage);
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

      expect(pushOrchestrator.createNotificationsForMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
        ],
      );
      expect(result.message).toEqual(mockMessage);
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
      expect(pushOrchestrator.createNotificationsForMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
        [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
        ],
      );
      expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
        expect(result.message).toEqual(mockMessage);
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
      expect(result.message).toEqual(mockMessage);
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
      expect(result.message).toEqual(mockMessage);
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
      expect(result.message).toEqual(mockMessage);
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
      expect(result.message).toEqual(mockMessage);
    });
  });

  describe('Template application', () => {
    let userTemplatesService: UserTemplatesService;
    let entityExecutionService: EntityExecutionService;

    beforeEach(() => {
      userTemplatesService = module.get<UserTemplatesService>(
        UserTemplatesService,
      );
      entityExecutionService = module.get<EntityExecutionService>(
        EntityExecutionService,
      );
    });

    const mockTemplate: UserTemplate = {
      id: 'template-uuid-123',
      name: 'Test Template',
      description: 'Test Description',
      title: 'Hello {{user.name}}!',
      subtitle: 'Status: {{status}}',
      body: 'Items:\n{{#each items}}\n- {{name}}: {{price}}\n{{/each}}',
      userId: 'user-1',
      user: mockUser as User,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should apply template when template name is provided', async () => {
      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original Title',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      const templateData = {
        user: { name: 'John Doe' },
        status: 'active',
        items: [
          { name: 'Item 1', price: 10 },
          { name: 'Item 2', price: 20 },
        ],
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(mockTemplate);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await service.applyTemplate(
        createMessageDto,
        'user-1',
        'Test Template',
        templateData,
      );

      expect(userTemplatesService.findByUserIdAndNameOrId).toHaveBeenCalledWith(
        'user-1',
        'Test Template',
      );
      expect(createMessageDto.title).toBe('Hello John Doe!');
      expect(createMessageDto.subtitle).toBe('Status: active');
      expect(createMessageDto.body).toBe(
        'Items:\n- Item 1: 10\n- Item 2: 20\n',
      );
      expect(entityExecutionService.create).toHaveBeenCalled();
    });

    it('should apply template when template UUID is provided', async () => {
      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original Title',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      const templateData = {
        user: { name: 'Jane Doe' },
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(mockTemplate);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await service.applyTemplate(
        createMessageDto,
        'user-1',
        'template-uuid-123',
        templateData,
      );

      expect(userTemplatesService.findByUserIdAndNameOrId).toHaveBeenCalledWith(
        'user-1',
        'template-uuid-123',
      );
      expect(createMessageDto.title).toBe('Hello Jane Doe!');
    });

    it('should handle template with complex nested objects', async () => {
      const complexTemplate: UserTemplate = {
        ...mockTemplate,
        title: '{{metadata.source}} - {{metadata.timestamp}}',
        subtitle: 'User: {{user.profile.name}} ({{user.profile.email}})',
        body: 'Tags: {{#each tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}',
      };

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      const templateData = {
        metadata: {
          source: 'webhook',
          timestamp: '2024-01-01T00:00:00Z',
        },
        user: {
          profile: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
        tags: ['urgent', 'important', 'notification'],
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(complexTemplate);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await service.applyTemplate(
        createMessageDto,
        'user-1',
        'complex-template',
        templateData,
      );

      expect(createMessageDto.title).toBe('webhook - 2024-01-01T00:00:00Z');
      expect(createMessageDto.subtitle).toBe(
        'User: John Doe (john@example.com)',
      );
      expect(createMessageDto.body).toBe('Tags: urgent, important, notification');
    });

    it('should handle template with arrays and conditionals', async () => {
      const conditionalTemplate: UserTemplate = {
        ...mockTemplate,
        title: '{{#if user}}Hello {{user}}!{{else}}Hello Guest!{{/if}}',
        body: '{{#if items}}Items ({{items.length}}):\n{{#each items}}\n- {{name}}\n{{/each}}{{else}}No items{{/if}}',
      };

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      const templateData = {
        user: 'John Doe',
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' },
        ],
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(conditionalTemplate);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await service.applyTemplate(
        createMessageDto,
        'user-1',
        'conditional-template',
        templateData,
      );

      expect(createMessageDto.title).toBe('Hello John Doe!');
      expect(createMessageDto.body).toContain('Items (3):');
      expect(createMessageDto.body).toContain('- Item 1');
      expect(createMessageDto.body).toContain('- Item 2');
      expect(createMessageDto.body).toContain('- Item 3');
    });

    it('should handle template with empty templateData', async () => {
      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(mockTemplate);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await service.applyTemplate(
        createMessageDto,
        'user-1',
        'Test Template',
        {},
      );

      expect(createMessageDto.title).toBe('Hello !');
      expect(createMessageDto.subtitle).toBe('Status: ');
    });

    it('should throw NotFoundException when template is not found', async () => {
      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(null);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await expect(
        service.applyTemplate(
          createMessageDto,
          'user-1',
          'NonExistentTemplate',
          { user: 'John' },
        ),
      ).rejects.toThrow('Template "NonExistentTemplate" not found');
    });

    it('should handle template with only title template', async () => {
      const titleOnlyTemplate: UserTemplate = {
        ...mockTemplate,
        title: 'Title: {{title}}',
        subtitle: undefined,
        body: 'Default body',
      };

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(titleOnlyTemplate);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await service.applyTemplate(
        createMessageDto,
        'user-1',
        'title-only',
        { title: 'Custom Title' },
      );

      expect(createMessageDto.title).toBe('Title: Custom Title');
      expect(createMessageDto.subtitle).toBeUndefined();
      expect(createMessageDto.body).toBe('Default body');
    });

    it('should not apply template when template name is not provided', async () => {
      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original Title',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      await service.applyTemplate(createMessageDto, 'user-1', '');

      expect(userTemplatesService.findByUserIdAndNameOrId).not.toHaveBeenCalled();
      expect(createMessageDto.title).toBe('Original Title');
    });

    it('should handle template rendering errors gracefully', async () => {
      const invalidTemplate: UserTemplate = {
        ...mockTemplate,
        body: '{{#invalid syntax}}',
      };

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(invalidTemplate);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await expect(
        service.applyTemplate(
          createMessageDto,
          'user-1',
          'invalid-template',
          { user: 'John' },
        ),
      ).rejects.toThrow('Error compiling body template');
    });

    it('should track template execution in EntityExecution', async () => {
      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original Title',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      const templateData = {
        user: { name: 'John Doe' },
        status: 'active',
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(mockTemplate);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await service.applyTemplate(
        createMessageDto,
        'user-1',
        'Test Template',
        templateData,
      );

      expect(entityExecutionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MESSAGE_TEMPLATE',
          status: 'SUCCESS',
          entityName: 'Test Template',
          entityId: 'template-uuid-123',
          userId: 'user-1',
          input: expect.stringMatching(/.*"template":"Test Template".*"titleTemplate":"Hello \{\{user\.name\}\}!".*"subtitleTemplate":"Status: \{\{status\}\}".*"bodyTemplate":"Items:\\n\{\{#each items\}\}\\n- \{\{name\}\}: \{\{price\}\}\\n\{\{\/each\}\}".*/s),
          output: expect.stringContaining('"title":"Hello John Doe!"'),
          errors: undefined,
          durationMs: expect.any(Number),
        }),
      );
    });

    it('should track template execution errors in EntityExecution', async () => {
      const invalidTemplate: UserTemplate = {
        ...mockTemplate,
        body: '{{#invalid syntax}}',
      };

      const createMessageDto: CreateMessageDto = {
        bucketId: 'bucket-1',
        title: 'Original',
        deliveryType: NotificationDeliveryType.NORMAL,
      };

      jest
        .spyOn(userTemplatesService, 'findByUserIdAndNameOrId')
        .mockResolvedValue(invalidTemplate);

      jest.spyOn(entityExecutionService, 'create').mockResolvedValue({} as any);

      await expect(
        service.applyTemplate(
          createMessageDto,
          'user-1',
          'invalid-template',
          { user: 'John' },
        ),
      ).rejects.toThrow('Error compiling body template');

      expect(entityExecutionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MESSAGE_TEMPLATE',
          status: 'ERROR',
          entityName: 'invalid-template',
          entityId: undefined,
          userId: 'user-1',
          input: expect.stringMatching(/.*"template":"invalid-template".*"bodyTemplate":"\{\{#invalid syntax\}\}".*/s),
          output: undefined,
          errors: expect.stringContaining('Error compiling body template'),
          durationMs: expect.any(Number),
        }),
      );
    });
  });
});
