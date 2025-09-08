import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttachmentsService } from '../attachments/attachments.service';
import { ResourceType } from '../auth/dto/auth.dto';
import { Bucket } from '../entities/bucket.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from '../notifications/notifications.types';
import { PushNotificationOrchestratorService } from '../notifications/push-orchestrator.service';
import { PayloadMapperService } from '../payload-mapper/payload-mapper.service';
import {
  CreateMessageDto,
  CreateMessageWithAttachmentDto,
  NotificationAttachmentDto,
} from './dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(Bucket)
    private readonly bucketsRepository: Repository<Bucket>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly attachmentsService: AttachmentsService,
    private readonly pushOrchestrator: PushNotificationOrchestratorService,
    private readonly configService: ConfigService,
    private readonly eventTrackingService: EventTrackingService,
    private readonly payloadMapperService: PayloadMapperService,
  ) {}

  private isUuid(identifier: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(identifier);
  }

  private async findBucketByIdOrName(
    bucketIdOrName: string,
    userId: string,
  ): Promise<Bucket> {
    // First try to find by ID (if it's a valid UUID format)
    const isUuid = this.isUuid(bucketIdOrName);

    let bucket: Bucket | null = null;

    if (isUuid) {
      // Try to find by ID first
      bucket = await this.bucketsRepository
        .createQueryBuilder('bucket')
        .leftJoinAndSelect('bucket.user', 'user')
        .leftJoin(
          'entity_permissions',
          'ep',
          'ep.resourceType = :resourceType AND ep.resourceId = bucket.id AND ep.userId = :userId',
          { resourceType: ResourceType.BUCKET, userId },
        )
        .where(
          'bucket.id = :bucketId AND ' +
            '(bucket.userId = :userId OR bucket.isPublic = true OR ep.id IS NOT NULL)',
          { bucketId: bucketIdOrName, userId },
        )
        .getOne();
    }

    // If not found by ID or not a UUID, try by name
    if (!bucket) {
      bucket = await this.bucketsRepository
        .createQueryBuilder('bucket')
        .leftJoinAndSelect('bucket.user', 'user')
        .leftJoin(
          'entity_permissions',
          'ep',
          'ep.resourceType = :resourceType AND ep.resourceId = bucket.id AND ep.userId = :userId',
          { resourceType: ResourceType.BUCKET, userId },
        )
        .where(
          'bucket.name = :bucketName AND ' +
            '(bucket.userId = :userId OR bucket.isPublic = true OR ep.id IS NOT NULL)',
          { bucketName: bucketIdOrName, userId },
        )
        .getOne();
    }

    if (!bucket) {
      throw new NotFoundException(
        `Bucket with ID or name '${bucketIdOrName}' not found or you do not have access to it`,
      );
    }

    return bucket;
  }

  private async findUsersByIdsOrUsernames(
    userIdsOrUsernames: string[],
  ): Promise<User[]> {
    if (!userIdsOrUsernames || userIdsOrUsernames.length === 0) {
      return [];
    }

    // Separate UUIDs from usernames
    const userIds = userIdsOrUsernames.filter((id) => this.isUuid(id));
    const usernames = userIdsOrUsernames.filter((id) => !this.isUuid(id));

    let users: User[] = [];

    // Find users by ID first (only if we have valid UUIDs)
    if (userIds.length > 0) {
      const usersById = await this.usersRepository.find({
        where: { id: In(userIds) },
      });
      users = [...users, ...usersById];
    }

    // Find users by username (only if we have usernames)
    if (usernames.length > 0) {
      const usersByUsername = await this.usersRepository.find({
        where: { username: In(usernames) },
      });
      users = [...users, ...usersByUsername];
    }

    // Check if all requested users were found
    // Create a set of all found identifiers (both IDs and usernames)
    const foundIdentifiers = new Set<string>();
    users.forEach((user) => {
      foundIdentifiers.add(user.id);
      foundIdentifiers.add(user.username);
    });

    const notFound = userIdsOrUsernames.filter(
      (identifier) => !foundIdentifiers.has(identifier),
    );

    if (notFound.length > 0) {
      throw new NotFoundException(
        `Users with IDs or usernames not found: ${notFound.join(', ')}`,
      );
    }

    return users;
  }

  async create(
    createMessageDto: CreateMessageDto,
    requesterId: string,
  ): Promise<Message> {
    // Validate bucket exists to avoid FK violation
    this.logger.log(
      `Creating message for bucketId=${createMessageDto.bucketId} by user=${requesterId}`,
    );
    const bucket = await this.findBucketByIdOrName(
      createMessageDto.bucketId,
      requesterId,
    );

    // Process userIds - convert usernames to user IDs if needed
    let processedUserIds: string[] = [];
    if (createMessageDto.userIds && createMessageDto.userIds.length > 0) {
      const users = await this.findUsersByIdsOrUsernames(
        createMessageDto.userIds,
      );
      processedUserIds = users.map((user) => user.id);
    }

    // Process attachments before creating the message
    const processedAttachments: NotificationAttachmentDto[] = [];
    let attachmentUuids: string[] = [];

    // Process URL-based attachments (imageUrl, videoUrl, gifUrl)
    const urlAttachments = await this.processUrlAttachments(createMessageDto);
    processedAttachments.push(...urlAttachments);

    // Process tapUrl to set tapAction
    let tapAction = createMessageDto.tapAction;
    if (createMessageDto.tapUrl) {
      tapAction = {
        type: NotificationActionType.NAVIGATE,
        value: createMessageDto.tapUrl,
      };
    }

    if (
      createMessageDto.attachments &&
      createMessageDto.attachments.length > 0
    ) {
      const existingAttachments = await this.processAttachments(
        createMessageDto.attachments,
        requesterId,
      );
      processedAttachments.push(...existingAttachments);
    }

    // Extract attachment UUIDs for the message
    attachmentUuids = processedAttachments
      .filter((att) => att.attachmentUuid)
      .map((att) => att.attachmentUuid!)
      .filter(Boolean);

    // Automatically add bucket icon as attachment if bucket has an icon
    if (bucket.icon && bucket.icon.startsWith('http')) {
      const bucketIconAttachment = await this.addBucketIconAttachment(
        bucket,
        processedAttachments,
      );
      if (bucketIconAttachment) {
        processedAttachments.push(bucketIconAttachment);
      }
    }

    const message = this.messagesRepository.create({
      ...createMessageDto,
      bucketId: bucket.id, // Always use the bucket ID, not the name
      attachments: processedAttachments,
      attachmentUuids,
      tapAction,
    });

    const savedMessage: Message = await this.messagesRepository.save(
      message as any,
    );
    this.logger.log(`Message created with ID: ${savedMessage.id}`);

    // Track message event
    await this.eventTrackingService.trackMessage(requesterId);

    // Link attachments to the message
    if (attachmentUuids.length > 0) {
      await this.linkAttachmentsToMessage(attachmentUuids, savedMessage.id);
    }

    // Reload with relations required by GraphQL (bucket non-null)
    const savedMessageWithRelations: Message | null =
      await this.messagesRepository.findOne({
        where: { id: savedMessage.id },
        relations: ['bucket'],
      });

    try {
      const baseMessage: Message = savedMessageWithRelations || savedMessage;
      const notifications = await this.pushOrchestrator.create(
        baseMessage,
        requesterId,
        processedUserIds,
      );
      this.logger.log(
        `Created ${notifications.length} notifications for message ${baseMessage.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create notifications for message ${savedMessage.id}`,
        error,
      );
      // Don't fail the message creation if notifications fail
    }

    return savedMessageWithRelations || savedMessage;
  }

  private async processAttachments(
    attachments: NotificationAttachmentDto[],
    userId: string,
  ): Promise<NotificationAttachmentDto[]> {
    const processedAttachments: NotificationAttachmentDto[] = [];

    for (const attachment of attachments) {
      const processedAttachment = { ...attachment };

      // Validate that either url or attachmentUuid is provided, but not both
      if (attachment.url && attachment.attachmentUuid) {
        throw new BadRequestException(
          'Cannot provide both url and attachmentUuid for the same attachment',
        );
      }

      if (!attachment.url && !attachment.attachmentUuid) {
        throw new BadRequestException(
          'Either url or attachmentUuid must be provided for each attachment',
        );
      }

      if (attachment.url) {
        // If saveOnServer is true, download and save the file
        if (attachment.saveOnServer) {
          try {
            const savedAttachment =
              await this.attachmentsService.downloadAndSaveFromUrl(
                userId,
                attachment.url,
                attachment.name,
                attachment.mediaType,
              );

            // Replace url with attachmentUuid
            processedAttachment.url = undefined;
            processedAttachment.attachmentUuid = savedAttachment.id;
          } catch (error) {
            this.logger.error(
              `Failed to download attachment from URL: ${attachment.url}`,
              error,
            );
            throw new BadRequestException(
              `Failed to download attachment from URL: ${attachment.url}`,
            );
          }
        }
      } else if (attachment.attachmentUuid) {
        // Attachment already exists, no need to build localUrl
      }

      processedAttachments.push(processedAttachment);
    }

    return processedAttachments;
  }

  /**
   * Process URL-based attachments (imageUrl, videoUrl, gifUrl) and convert them to NotificationAttachmentDto
   */
  private async processUrlAttachments(
    createMessageDto: CreateMessageDto,
  ): Promise<NotificationAttachmentDto[]> {
    const urlAttachments: NotificationAttachmentDto[] = [];

    if (createMessageDto.imageUrl) {
      urlAttachments.push({
        mediaType: MediaType.IMAGE,
        url: createMessageDto.imageUrl,
        name: 'Image',
        saveOnServer: false,
      });
    }

    if (createMessageDto.videoUrl) {
      urlAttachments.push({
        mediaType: MediaType.VIDEO,
        url: createMessageDto.videoUrl,
        name: 'Video',
        saveOnServer: false,
      });
    }

    if (createMessageDto.gifUrl) {
      urlAttachments.push({
        mediaType: MediaType.GIF,
        url: createMessageDto.gifUrl,
        name: 'GIF',
        saveOnServer: false,
      });
    }

    return urlAttachments;
  }

  /**
   * Add bucket icon as attachment if bucket has an icon and it's not already present
   */
  private async addBucketIconAttachment(
    bucket: Bucket,
    existingAttachments: NotificationAttachmentDto[],
  ): Promise<NotificationAttachmentDto | null> {
    if (!bucket.icon) {
      return null;
    }

    // Check if an ICON attachment is already present to avoid duplicates
    const hasIconAttachment = existingAttachments.some(
      (att) => att.mediaType === MediaType.ICON,
    );
    if (hasIconAttachment) {
      return null;
    }

    try {
      // Create bucket icon attachment
      const iconAttachment: NotificationAttachmentDto = {
        mediaType: MediaType.ICON,
        name: `${bucket.name} Icon`,
        url: bucket.icon,
        saveOnServer: false, // Keep as URL reference, don't download
      };

      return iconAttachment;
    } catch (error) {
      this.logger.error(
        `Failed to add bucket icon attachment for bucket ${bucket.id}`,
        error,
      );
      return null;
    }
  }

  /**
   * Create a message with an uploaded attachment
   */
  async createWithAttachment(
    input: CreateMessageWithAttachmentDto,
    userId: string,
    attachment: Express.Multer.File,
  ): Promise<Message> {
    const normalizedInput = input as any;
    this.logger.log(
      `Creating message with attachment for bucketId=${normalizedInput.bucketId} by user=${userId}`,
    );

    // Validate bucket exists
    const bucket = await this.bucketsRepository.findOne({
      where: { id: normalizedInput.bucketId },
    });
    if (!bucket) {
      throw new NotFoundException(
        `Bucket ${normalizedInput.bucketId} not found`,
      );
    }

    // Determine filename: use attachmentOptions.name if provided, otherwise use original filename
    const filename =
      normalizedInput.attachmentOptions.name ||
      attachment.originalname ||
      'uploaded-file';

    // Determine mediaType: use attachmentOptions.mediaType if provided, otherwise try to infer from mimetype
    let mediaType = normalizedInput.attachmentOptions.mediaType;
    if (!mediaType && attachment.mimetype) {
      // Try to infer mediaType from mimetype
      if (attachment.mimetype === 'image/gif') {
        mediaType = MediaType.GIF;
      } else if (attachment.mimetype.startsWith('image/')) {
        mediaType = MediaType.IMAGE;
      } else if (attachment.mimetype.startsWith('video/')) {
        mediaType = MediaType.VIDEO;
      } else if (attachment.mimetype.startsWith('audio/')) {
        mediaType = MediaType.AUDIO;
      }
    }

    // Save the uploaded attachment
    const savedAttachment = await this.attachmentsService.uploadAttachment(
      userId,
      {
        filename,
        mediaType,
      },
      attachment,
    );

    // Create attachment DTO for the message
    const attachmentDto: NotificationAttachmentDto = {
      mediaType,
      name: filename,
      attachmentUuid: savedAttachment.id,
    };

    // Prepare attachments array
    const attachments: NotificationAttachmentDto[] = [attachmentDto];

    // Automatically add bucket icon as attachment if bucket has an icon
    if (bucket.icon) {
      const bucketIconAttachment = await this.addBucketIconAttachment(
        bucket,
        attachments,
      );
      if (bucketIconAttachment) {
        attachments.push(bucketIconAttachment);
      }
    }

    // Create the message with the attachment
    const messageInput: CreateMessageDto = {
      ...normalizedInput,
      attachments,
    };
    // Already validated by ValidationPipe

    // Create the message using the existing logic
    const savedMessage = await this.create(messageInput, userId);

    // Link the attachment to the message
    await this.attachmentsService.linkAttachmentToMessage(
      savedAttachment.id,
      savedMessage.id,
    );

    return savedMessage;
  }

  private async linkAttachmentsToMessage(
    attachmentUuids: string[],
    messageId: string,
  ): Promise<void> {
    for (const attachmentUuid of attachmentUuids) {
      try {
        await this.attachmentsService.linkAttachmentToMessage(
          attachmentUuid,
          messageId,
        );
      } catch (error) {
        this.logger.error(
          `Failed to link attachment ${attachmentUuid} to message ${messageId}`,
          error,
        );
        // Don't fail the message creation if linking fails
      }
    }
  }

  /**
   * Find all messages
   */
  async findAll(): Promise<Message[]> {
    return this.messagesRepository.find({
      relations: ['bucket'],
    });
  }

  /**
   * Find a message by ID
   */
  async findOne(id: string): Promise<Message | null> {
    return this.messagesRepository.findOne({
      where: { id },
      relations: ['bucket', 'fileAttachments'],
    });
  }

  private parseDurationToMs(input: string): number {
    if (!input) return 0;
    // If pure number, assume seconds like JWT, convert to ms
    if (/^\d+$/.test(input)) {
      const seconds = parseInt(input, 10);
      return seconds * 1000;
    }
    const match = input.match(/^(\d+)(ms|s|m|h|d)$/i);
    if (!match) return 0;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  /**
   * Delete messages whose ALL related notifications have receivedAt set.
   * Returns the number of deleted messages.
   */
  async deleteMessagesFullyRead(): Promise<{ deletedMessages: number }> {
    const maxAgeInput =
      this.configService.get<string>('MESSAGES_MAX_AGE') || '0';
    const maxAgeMs = this.parseDurationToMs(maxAgeInput);
    this.logger.log(
      `Scanning messages for cleanup (all notifications received${maxAgeMs ? ` or older than ${maxAgeMs}ms` : ''})`,
    );
    // Load all messages with their linked notification IDs to minimize queries
    const messages = await this.messagesRepository.find();

    if (messages.length === 0) return { deletedMessages: 0 };

    // Map messageId -> notifications receivedAt counts
    const messageIds = messages.map((m) => m.id);
    const notifications = await this.notificationsRepository.find({
      where: { message: { id: In(messageIds) } as any },
      relations: ['message', 'userDevice'],
    });

    const messageIdToNotifications: Record<string, Notification[]> = {};
    for (const n of notifications) {
      const mId = n.message?.id;
      if (!mId) continue;
      if (!messageIdToNotifications[mId]) messageIdToNotifications[mId] = [];
      messageIdToNotifications[mId].push(n);
    }

    // Determine messages whose all notifications have receivedAt set, or older than maxAge, or have no notifications at all
    const deletableMessageIds: string[] = [];
    const now = Date.now();
    for (const m of messages) {
      const isExpired =
        !!maxAgeMs &&
        m.createdAt &&
        now - new Date(m.createdAt).getTime() >= maxAgeMs;
      if (isExpired) {
        deletableMessageIds.push(m.id);
        continue;
      }
      const list = messageIdToNotifications[m.id] || [];
      if (list.length === 0) {
        // Delete orphan messages with no notifications
        deletableMessageIds.push(m.id);
        continue;
      }
      // Check if all notifications have been received by a device (have both receivedAt and userDeviceId)
      const allReceived = list.every((n) => !!n.receivedAt && !!n.userDeviceId);
      if (allReceived) deletableMessageIds.push(m.id);
    }

    if (deletableMessageIds.length === 0) {
      this.logger.log('No fully-received messages to delete');
      return { deletedMessages: 0 };
    }
    this.logger.log(
      `Deleting ${deletableMessageIds.length} fully-received message(s)`,
    );

    // Delete notifications first (not strictly necessary with ON DELETE CASCADE on notifications.messageId)
    await this.notificationsRepository.delete({
      message: { id: In(deletableMessageIds) } as any,
    });
    // Delete messages
    const result = await this.messagesRepository.delete(deletableMessageIds);
    const deleted = result.affected || 0;
    this.logger.log(`Deleted ${deleted} message(s)`);
    return { deletedMessages: deleted };
  }

  /**
   * Delete messages only for the provided message IDs when all their notifications
   * have been received. This limits the cleanup scan to messages that were
   * affected by a recent operation.
   */
  async deleteMessagesIfAllNotificationsReceived(
    messageIds: string[],
  ): Promise<{ deletedMessages: number }> {
    if (!messageIds || messageIds.length === 0) return { deletedMessages: 0 };

    this.logger.log(
      `Cleaning up messages for provided IDs (${messageIds.length})`,
    );

    // Load notifications for these messages
    const notifications = await this.notificationsRepository.find({
      where: { message: { id: In(messageIds) } as any },
      relations: ['message', 'userDevice'],
    });

    const messageIdToNotifications: Record<string, Notification[]> = {};
    for (const n of notifications) {
      const mId = n.message?.id;
      if (!mId) continue;
      if (!messageIdToNotifications[mId]) messageIdToNotifications[mId] = [];
      messageIdToNotifications[mId].push(n);
    }

    const deletableMessageIds: string[] = [];
    for (const mId of messageIds) {
      const list = messageIdToNotifications[mId] || [];
      if (list.length === 0) {
        // No notifications -> delete
        deletableMessageIds.push(mId);
        continue;
      }
      const allReceived = list.every((n) => !!n.receivedAt && !!n.userDeviceId);
      if (allReceived) deletableMessageIds.push(mId);
    }

    if (deletableMessageIds.length === 0) {
      this.logger.log('No fully-received messages to delete (filtered)');
      return { deletedMessages: 0 };
    }

    await this.notificationsRepository.delete({
      message: { id: In(deletableMessageIds) } as any,
    });
    const result = await this.messagesRepository.delete(deletableMessageIds);
    const deleted = result.affected || 0;
    this.logger.log(`Deleted ${deleted} message(s) (filtered)`);
    return { deletedMessages: deleted };
  }

  /**
   * Transform payload using parser and create message
   */
  async transformAndCreate(parserName: string, payload: any, userId: string, bucketId: string): Promise<Message> {
    // Delegate to PayloadMapperService for parser identification and transformation
    const transformedPayload = await this.payloadMapperService.transformPayload(parserName, payload, userId, bucketId);

    // Create the message using the transformed payload
    return this.create(transformedPayload, userId);
  }
}
