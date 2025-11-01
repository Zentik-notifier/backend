import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationPostponeService } from 'src/notifications/notification-postpone.service';
import { In, Repository } from 'typeorm';
import { MessageReminderService } from './message-reminder.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ResourceType } from '../auth/dto/auth.dto';
import { Bucket } from '../entities/bucket.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { ServerSettingType } from '../entities/server-setting.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { UserSettingType } from '../entities/user-setting.types';
import { User } from '../entities/user.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import {
  MediaType,
  NotificationActionType,
} from '../notifications/notifications.types';
import { PushNotificationOrchestratorService } from '../notifications/push-orchestrator.service';
import { PayloadMapperService } from '../payload-mapper/payload-mapper.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { UsersService } from '../users/users.service';
import { isUuid } from '../common/utils/validation.utils';
import { UrlBuilderService } from '../common/services/url-builder.service';
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
    @InjectRepository(UserBucket)
    private readonly userBucketRepository: Repository<UserBucket>,
    private readonly attachmentsService: AttachmentsService,
    private readonly pushOrchestrator: PushNotificationOrchestratorService,
    private readonly serverSettingsService: ServerSettingsService,
    private readonly eventTrackingService: EventTrackingService,
    private readonly payloadMapperService: PayloadMapperService,
    private readonly usersService: UsersService,
    private readonly postponeService: NotificationPostponeService,
    private readonly reminderService: MessageReminderService,
    private readonly urlBuilderService: UrlBuilderService,
  ) {}


  private async findBucketByIdOrName(
    bucketIdOrName: string,
    userId: string,
  ): Promise<Bucket> {
    // Try to find by ID (if it's a valid UUID format)
    const isValidUuid = isUuid(bucketIdOrName);

    let bucket: Bucket | null = null;

    if (isValidUuid) {
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
    const userIds = userIdsOrUsernames.filter((id) => isUuid(id));
    const usernames = userIdsOrUsernames.filter((id) => !isUuid(id));

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
    requesterId: string | undefined,
    skipEventTracking = false,
    executionId?: string,
  ): Promise<Message> {
    const bucket = await this.findBucketByIdOrName(
      createMessageDto.bucketId,
      requesterId || '',
    );

    if (!requesterId) {
      throw new UnauthorizedException('Unable to determine user ID for message creation');
    }

    // If locale missing, fallback from user settings
    if (!createMessageDto.locale) {
      try {
        const lang = await this.usersService.getUserSetting(
          requesterId,
          UserSettingType.Language,
          null,
        );
        if (lang?.valueText) {
          createMessageDto.locale = lang.valueText as any;
        }
      } catch {}
    }

    // Process userIds - convert usernames to user IDs if needed
    let processedUserIds: string[] = [];
    if (createMessageDto.userIds && createMessageDto.userIds.length > 0) {
      const users = await this.findUsersByIdsOrUsernames(
        createMessageDto.userIds,
      );
      processedUserIds = users.map((user) => user.id);
    }

    // Check if attachments are enabled when saveOnServer is requested
    const attachmentsEnabled = await this.attachmentsService.isAttachmentsEnabled();
    if (
      !attachmentsEnabled &&
      createMessageDto.attachments?.some((att) => att.saveOnServer === true)
    ) {
      throw new BadRequestException(
        'Attachments are currently disabled, cannot save to server',
      );
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

    // Process attachmentUuids if provided
    if (createMessageDto.attachmentUuids && createMessageDto.attachmentUuids.length > 0) {
      const resolvedAttachments = await this.resolveAttachmentUuids(
        createMessageDto.attachmentUuids,
        requesterId,
      );
      processedAttachments.push(...resolvedAttachments);
    }

    // Extract attachment UUIDs for the message
    attachmentUuids = processedAttachments
      .filter((att) => att.attachmentUuid)
      .map((att) => att.attachmentUuid!)
      .filter(Boolean);

    const message = this.messagesRepository.create({
      ...createMessageDto,
      bucketId: bucket.id, // Always use the bucket ID, not the name
      attachments: processedAttachments,
      attachmentUuids,
      tapAction,
      executionId: executionId || createMessageDto.executionId,
    });

    const savedMessage: Message = await this.messagesRepository.save(
      message as any,
    );

    // Track message event (skip for admin notifications to prevent infinite loops)
    if (!skipEventTracking) {
      await this.eventTrackingService.trackMessage(requesterId);
    }

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
        skipEventTracking, // Also skip notification tracking to prevent infinite loop
      );

      // Create reminders if remindEveryMinutes is set
      if (createMessageDto.remindEveryMinutes) {
        const maxReminders = createMessageDto.maxReminders || 5;
        
        // Get all user IDs that received notifications
        const userIdsToRemind = processedUserIds.length > 0
          ? processedUserIds
          : notifications.map(n => n.userId).filter((v, i, a) => a.indexOf(v) === i);

        // Create a reminder for each user
        for (const userId of userIdsToRemind) {
          try {
            await this.reminderService.createReminder(
              savedMessage.id,
              userId,
              createMessageDto.remindEveryMinutes,
              maxReminders,
            );
          } catch (error) {
            this.logger.error(
              `Failed to create reminder for user ${userId} on message ${savedMessage.id}`,
              error,
            );
            // Don't fail message creation if reminder creation fails
          }
        }

        this.logger.log(
          `Created reminders for ${userIdsToRemind.length} user(s) on message ${savedMessage.id}`,
        );
      }
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
        // Attachment already exists, add public URL for direct access
        processedAttachment.url = this.urlBuilderService.buildAttachmentUrl(attachment.attachmentUuid);
      }

      processedAttachments.push(processedAttachment);
    }

    return processedAttachments;
  }

  /**
   * Resolve attachment UUIDs to NotificationAttachmentDto objects
   */
  private async resolveAttachmentUuids(
    attachmentUuids: string[],
    userId: string,
  ): Promise<NotificationAttachmentDto[]> {
    const resolvedAttachments: NotificationAttachmentDto[] = [];

    for (const uuid of attachmentUuids) {
      try {
        // Validate UUID format
        if (!isUuid(uuid)) {
          this.logger.warn(`Invalid attachment UUID format: ${uuid}`);
          continue;
        }

        // Get attachment from database (includes user access validation)
        const attachment = await this.attachmentsService.findOne(uuid, userId);

        // Create NotificationAttachmentDto with resolved data
        const resolvedAttachment: NotificationAttachmentDto = {
          attachmentUuid: uuid,
          mediaType: attachment.mediaType || MediaType.ICON, // Fallback to ICON if undefined
          name: attachment.filename,
          url: this.urlBuilderService.buildAttachmentUrl(uuid),
        };

        resolvedAttachments.push(resolvedAttachment);
      } catch (error) {
        this.logger.error(`Failed to resolve attachment UUID ${uuid}:`, error);
        // Continue processing other UUIDs even if one fails
      }
    }

    return resolvedAttachments;
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
        saveOnServer: false,
      });
    }

    if (createMessageDto.videoUrl) {
      urlAttachments.push({
        mediaType: MediaType.VIDEO,
        url: createMessageDto.videoUrl,
        saveOnServer: false,
      });
    }

    if (createMessageDto.gifUrl) {
      urlAttachments.push({
        mediaType: MediaType.GIF,
        url: createMessageDto.gifUrl,
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
      (await this.serverSettingsService.getSettingByType(ServerSettingType.MessagesMaxAge))?.valueText || '7d';
    const maxAgeMs = this.parseDurationToMs(maxAgeInput);
    this.logger.log(
      `Scanning messages for cleanup (all notifications received${maxAgeMs ? ` or older than ${maxAgeMs}ms` : ''})`,
    );
    // Load all messages with their buckets to check protection status
    const messages = await this.messagesRepository.find({
      relations: ['bucket'],
    });

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
    // BUT exclude messages that have pending postpones OR belong to protected buckets
    const deletableMessageIds: string[] = [];
    const now = Date.now();
    for (const m of messages) {
      // Skip messages from protected buckets
      if (m.bucket?.isProtected) {
        continue;
      }

      // Check if message has pending postpones
      const hasPendingPostpones = this.postponeService
        ? await this.postponeService.hasPendingPostpones(m.id)
        : false;
      
      if (hasPendingPostpones) {
        this.logger.debug(
          `Skipping message ${m.id} - has pending postpones`,
        );
        continue;
      }

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
   * Transform payload using parser and create message
   */
  async transformAndCreate(
    parserName: string,
    payload: any,
    userId: string,
    bucketId: string,
    headers?: Record<string, string>,
  ): Promise<Message | undefined> {
    // Delegate to PayloadMapperService for parser identification and transformation
    const { messageDto, executionId } = await this.payloadMapperService.transformPayload(
      parserName,
      payload,
      userId,
      bucketId,
      headers,
    );

    // If parser was skipped, return undefined
    if (!messageDto) {
      return undefined;
    }

    // Create the message using the transformed payload and execution ID
    return this.create(messageDto, userId, false, executionId);
  }
}
