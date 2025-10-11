import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Event, EventType } from '../entities';
import { AdminSubscription } from '../entities/admin-subscription.entity';
import { UserDevice } from '../entities/user-device.entity';
import { User } from '../entities/user.entity';
import { Bucket } from '../entities/bucket.entity';
import { MessagesService } from '../messages/messages.service';
import {
  CreateEventDto,
  EventsQueryDto,
  EventsResponseDto,
  EventsPaginatedQueryDto,
} from './dto';
import { NotificationDeliveryType } from 'src/notifications/notifications.types';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private adminBucketId: string | null = null;

  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    @InjectRepository(AdminSubscription)
    private adminSubscriptionRepository: Repository<AdminSubscription>,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Bucket)
    private bucketRepository: Repository<Bucket>,
    @Inject(forwardRef(() => MessagesService))
    private messagesService: MessagesService,
  ) {}

  async createEvent(createEventDto: CreateEventDto): Promise<Event> {
    const event = this.eventsRepository.create(createEventDto);
    const savedEvent = await this.eventsRepository.save(event);

    this.notifySubscribedAdmins(savedEvent).catch((error) => {
      this.logger.error(
        `Failed to notify admins for event ${savedEvent.id}:`,
        error,
      );
    });

    return savedEvent;
  }

  private async getAdminBucket(): Promise<Bucket | null> {
    if (this.adminBucketId) {
      const bucket = await this.bucketRepository.findOne({
        where: { id: this.adminBucketId },
      });
      if (bucket) return bucket;
    }

    const adminBucket = await this.bucketRepository.findOne({
      where: { isAdmin: true },
    });

    if (adminBucket) {
      this.adminBucketId = adminBucket.id;
      this.logger.log(`Found admin bucket: ${adminBucket.name} (${adminBucket.id})`);
    } else {
      this.logger.warn('No admin bucket found (isAdmin = true)');
    }

    return adminBucket;
  }

  private async getSubscribedAdmins(eventType: EventType): Promise<string[]> {
    const subscriptions = await this.adminSubscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.user', 'user')
      .where(':eventType = ANY(subscription.eventTypes)', { eventType })
      .andWhere('user.isAdmin = :isAdmin', { isAdmin: true })
      .getMany();

    return subscriptions.map((sub) => sub.userId);
  }

  private async notifySubscribedAdmins(event: Event): Promise<void> {
    try {
      const adminUserIds = await this.getSubscribedAdmins(event.type);

      if (adminUserIds.length === 0) {
        this.logger.debug(
          `No admins subscribed to event type ${event.type}, skipping notifications`,
        );
        return;
      }

      this.logger.log(
        `Sending notifications to ${adminUserIds.length} admins for event ${event.type}`,
      );

      for (const userId of adminUserIds) {
        await this.sendAdminNotification(userId, event);
      }
    } catch (error) {
      this.logger.error('Error notifying subscribed admins:', error);
      throw error;
    }
  }

  private async sendAdminNotification(
    userId: string,
    event: Event,
  ): Promise<void> {
    try {
      const adminBucket = await this.getAdminBucket();
      if (!adminBucket) {
        this.logger.warn('Cannot send admin notification: no admin bucket found');
        return;
      }

      const bucketWithUser = adminBucket.user
        ? adminBucket
        : await this.bucketRepository.findOne({
            where: { id: adminBucket.id },
            relations: ['user'],
          });

      if (!bucketWithUser || !bucketWithUser.user) {
        this.logger.error('Admin bucket has no owner user');
        return;
      }

      const eventDetails = await this.getEventDetails(event);

      const message = await this.messagesService.create(
        {
          bucketId: adminBucket.id,
          title: this.formatEventTitle(event.type),
          body: this.formatEventMessage(event, eventDetails),
          userIds: [userId], 
          deliveryType: NotificationDeliveryType.NORMAL
        },
        bucketWithUser.user.id,
      );

      this.logger.debug(
        `Created admin notification message ${message.id} for event ${event.id} to admin ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending notification to admin ${userId}:`,
        error,
      );
    }
  }

  private async getEventDetails(event: Event): Promise<any> {
    const details: any = {};

    if (event.userId) {
      const user = await this.userRepository.findOne({
        where: { id: event.userId },
      });
      if (user) {
        details.username = user.username;
        details.email = user.email;
        details.userFullName = [user.firstName, user.lastName]
          .filter(Boolean)
          .join(' ') || user.username;
      }
    }

    if (
      event.targetId &&
      (event.type === EventType.DEVICE_REGISTER ||
        event.type === EventType.DEVICE_UNREGISTER ||
        event.type === EventType.NOTIFICATION)
    ) {
      const device = await this.userDeviceRepository.findOne({
        where: { id: event.targetId },
      });
      if (device) {
        details.devicePlatform = device.platform;
        details.deviceName = device.deviceName;
        details.deviceModel = device.deviceModel;
      }
    }

    return details;
  }

  private formatEventTitle(eventType: EventType): string {
    const titles: Record<EventType, string> = {
      [EventType.LOGIN]: '🔐 User Login',
      [EventType.LOGIN_OAUTH]: '🔐 OAuth Login',
      [EventType.LOGOUT]: '👋 User Logout',
      [EventType.REGISTER]: '✨ New User Registration',
      [EventType.PUSH_PASSTHROUGH]: '📤 Push Passthrough',
      [EventType.MESSAGE]: '💬 New Message',
      [EventType.NOTIFICATION]: '🔔 Notification Sent',
      [EventType.BUCKET_SHARING]: '🔗 Bucket Shared',
      [EventType.BUCKET_UNSHARING]: '🔓 Bucket Unshared',
      [EventType.DEVICE_REGISTER]: '📱 Device Registered',
      [EventType.DEVICE_UNREGISTER]: '📱 Device Unregistered',
      [EventType.ACCOUNT_DELETE]: '⚠️ Account Deleted',
    };

    return titles[eventType] || `Event: ${eventType}`;
  }

  private formatEventMessage(event: Event, details: any = {}): string {
    const parts: string[] = [];

    if (details.userFullName) {
      parts.push(`User: ${details.userFullName}`);
    } else if (details.username) {
      parts.push(`User: ${details.username}`);
    } else if (event.userId) {
      parts.push(`User ID: ${event.userId}`);
    }

    if (details.email) {
      parts.push(`Email: ${details.email}`);
    }

    if (details.devicePlatform) {
      parts.push(`Device: ${details.devicePlatform}`);
    }

    if (details.deviceName) {
      parts.push(`Name: ${details.deviceName}`);
    }

    if (event.objectId) {
      parts.push(`Object: ${event.objectId}`);
    }

    if (event.targetId && !details.devicePlatform) {
      parts.push(`Target: ${event.targetId}`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'New event occurred';
  }

  async findAll(): Promise<Event[]> {
    return this.eventsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByType(type: EventType): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { type },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUserId(userId: string): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByObjectId(objectId: string): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { objectId },
      order: { createdAt: 'DESC' },
    });
  }

  async getEventCount(): Promise<number> {
    return this.eventsRepository.count();
  }

  async findAllPaginated(query: EventsQueryDto): Promise<EventsResponseDto> {
    const { page = 1, limit = 20, type, userId, objectId, targetId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.eventsRepository
      .createQueryBuilder('event')
      .orderBy('event.createdAt', 'DESC');

    if (type) {
      queryBuilder.andWhere('event.type = :type', { type });
    }

    if (userId) {
      queryBuilder.andWhere('event.userId = :userId', { userId });
    }

    if (objectId) {
      queryBuilder.andWhere('event.objectId = :objectId', { objectId });
    }

    if (targetId) {
      queryBuilder.andWhere('event.targetId = :targetId', { targetId });
    }

    const [events, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const response = new EventsResponseDto();
    response.events = events;
    response.total = total;
    response.page = page;
    response.limit = limit;

    return response;
  }

  async findByTypePaginated(
    type: EventType,
    query: EventsPaginatedQueryDto,
  ): Promise<EventsResponseDto> {
    return this.findAllPaginated({ ...query, type });
  }

  async findByUserIdPaginated(
    userId: string,
    query: EventsPaginatedQueryDto,
  ): Promise<EventsResponseDto> {
    return this.findAllPaginated({ ...query, userId });
  }

  async findByObjectIdPaginated(
    objectId: string,
    query: EventsPaginatedQueryDto,
  ): Promise<EventsResponseDto> {
    return this.findAllPaginated({ ...query, objectId });
  }
}
