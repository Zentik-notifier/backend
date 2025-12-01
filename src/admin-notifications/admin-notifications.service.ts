import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventType } from '../entities';
import { AdminSubscription } from '../entities/admin-subscription.entity';
import { UserDevice } from '../entities/user-device.entity';
import { UserSession } from '../entities/user-session.entity';
import { User } from '../entities/user.entity';
import { Bucket } from '../entities/bucket.entity';
import { MessagesService } from '../messages/messages.service';
import { EventsService } from '../events/events.service';
import { NotificationDeliveryType } from '../notifications/notifications.types';
import { UserRole } from '../users/users.types';

@Injectable()
export class AdminNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(AdminNotificationsService.name);
  private adminBucketId: string | null = null;

  constructor(
    @InjectRepository(AdminSubscription)
    private adminSubscriptionRepository: Repository<AdminSubscription>,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(UserSession)
    private userSessionRepository: Repository<UserSession>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Bucket)
    private bucketRepository: Repository<Bucket>,
    private messagesService: MessagesService,
    private eventsService: EventsService,
  ) { }

  onModuleInit() {
    this.eventsService.onEventCreated((event) => this.handleEventCreated(event));
    this.logger.log('Admin notifications service initialized and subscribed to events');
  }

  async handleEventCreated(event: Event): Promise<void> {
    this.notifySubscribedAdmins(event).catch((error) => {
      this.logger.error(
        `Failed to notify admins for event ${event.id}:`,
        error,
      );
    });
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
      // this.logger.log(`Found admin bucket: ${adminBucket.name} (${adminBucket.id})`);
    } else {
      // this.logger.warn('No admin bucket found (isAdmin = true)');
    }

    return adminBucket;
  }

  private async getSubscribedAdmins(eventType: EventType): Promise<string[]> {
    const subscriptions = await this.adminSubscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.user', 'user')
      .where(':eventType = ANY(subscription.eventTypes)', { eventType })
      .andWhere('user.role = :role', { role: UserRole.ADMIN })
      .getMany();

    return subscriptions.map((sub) => sub.userId);
  }

  private async notifySubscribedAdmins(event: Event): Promise<void> {
    try {
      const adminUserIds = await this.getSubscribedAdmins(event.type);

      if (adminUserIds.length === 0) {
        return;
      }

      this.logger.debug(
        `Sending notification to ${adminUserIds.length} admins for event ${event.type}`,
      );

      // Create a single message for all subscribed admins
      await this.sendAdminNotification(adminUserIds, event);
    } catch (error) {
      this.logger.error('Error notifying subscribed admins:', error);
      throw error;
    }
  }

  private async sendAdminNotification(
    adminUserIds: string[],
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

      // Create a single message with all admin users as recipients
      const message = await this.messagesService.create(
        {
          bucketId: adminBucket.id,
          title: this.formatEventTitle(event.type),
          body: this.formatEventMessage(event, eventDetails),
          userIds: adminUserIds, // Send to all subscribed admins
          deliveryType: NotificationDeliveryType.NORMAL
        },
        bucketWithUser.user.id,
        true, // Skip event tracking to prevent infinite loops
      );

      this.logger.debug(
        `Created admin notification message ${message.id} for event ${event.id} to ${adminUserIds.length} admin(s): ${adminUserIds.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending notification to admins:`,
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
        event.type === EventType.NOTIFICATION ||
        event.type === EventType.NOTIFICATION_ACK)
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

    // For OAuth login events, get the provider from the user's most recent session
    if (event.type === EventType.LOGIN_OAUTH && event.userId) {
      const session = await this.userSessionRepository
        .createQueryBuilder('session')
        .where('session.userId = :userId', { userId: event.userId })
        .andWhere('session.loginProvider IS NOT NULL')
        .orderBy('session.createdAt', 'DESC')
        .limit(1)
        .getOne();
      if (session) {
        details.oauthProvider = session.loginProvider;
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
      [EventType.NOTIFICATION_ACK]: '✅ Notification Acknowledged',
      [EventType.BUCKET_CREATION]: '🪣 Bucket Created',
      [EventType.BUCKET_SHARING]: '🔗 Bucket Shared',
      [EventType.BUCKET_UNSHARING]: '🔓 Bucket Unshared',
      [EventType.DEVICE_REGISTER]: '📱 Device Registered',
      [EventType.DEVICE_UNREGISTER]: '📱 Device Unregistered',
      [EventType.ACCOUNT_DELETE]: '⚠️ Account Deleted',
      [EventType.SYSTEM_TOKEN_REQUEST_CREATED]: '🔑 System Token Request Created',
      [EventType.SYSTEM_TOKEN_REQUEST_APPROVED]: '✅ System Token Request Approved',
      [EventType.SYSTEM_TOKEN_REQUEST_DECLINED]: '❌ System Token Request Declined',
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

    if (details.oauthProvider) {
      parts.push(`Provider: ${details.oauthProvider}`);
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
}
