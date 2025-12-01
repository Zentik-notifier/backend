import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { UrlBuilderService } from '../common/services/url-builder.service';
import { Notification } from '../entities/notification.entity';
import { ServerSettingType } from '../entities/server-setting.entity';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { DevicePlatform } from '../users/dto';
import { UsersService } from '../users/users.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { EventsService } from '../events/events.service';
import { Event, EventType } from '../entities/event.entity';
import { NotificationServiceInfo } from './dto';
import {
  ExternalDeviceDataFcmDto,
  ExternalDeviceDataIosDto,
  ExternalDeviceDataWebDto,
  ExternalNotifyRequestDto,
  ExternalPlatform,
} from './dto/external-notify.dto';
import { FirebasePushService } from './firebase-push.service';
import { IOSPushService } from './ios-push.service';
import { NotificationServiceType } from './notifications.types';
import { WebPushService } from './web-push.service';
import { MessageReminderService } from '../messages/message-reminder.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger('NotificationsService');

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    private readonly urlBuilderService: UrlBuilderService,
    private readonly usersService: UsersService,
    private readonly iosPushService: IOSPushService,
    private readonly firebasePushService: FirebasePushService,
    private readonly webPushService: WebPushService,
    private readonly serverSettingsService: ServerSettingsService,
    private readonly reminderService: MessageReminderService,
    private readonly eventTrackingService: EventTrackingService,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) { }

  async onModuleInit() {
    this.logger.log('Initializing push notification services...');
    await this.initializePushServices();
  }

  private async hasNotificationAckEvent(notificationId: string, deviceId: string): Promise<boolean> {
    const existingEvent = await this.eventsService.findAllPaginated({
      type: EventType.NOTIFICATION_ACK,
      objectId: notificationId,
      targetId: deviceId,
      page: 1,
      limit: 1,
    });
    return existingEvent.total > 0;
  }

  /**
   * Check in batch which notifications already have ACK events
   * Returns a Set of notification IDs that already have ACK events
   */
  private async getExistingAckEventNotificationIds(
    notifications: Array<{ id: string; userDeviceId: string }>,
  ): Promise<Set<string>> {
    if (notifications.length === 0) {
      return new Set();
    }

    // Build pairs of (notificationId, deviceId) for the query
    const notificationDevicePairs = notifications.map((n) => ({
      notificationId: n.id,
      deviceId: n.userDeviceId,
    }));

    if (notificationDevicePairs.length === 0) {
      return new Set();
    }

    // Get all notification IDs and device IDs
    const notificationIds = notificationDevicePairs.map((p) => p.notificationId);
    const deviceIds = notificationDevicePairs.map((p) => p.deviceId);

    // Create a Set for quick lookup of valid pairs
    const validPairs = new Set(
      notificationDevicePairs.map(
        (p) => `${p.notificationId}:${p.deviceId}`,
      ),
    );

    // Query for existing ACK events in batch
    // Get all events where objectId is in notificationIds and targetId is in deviceIds
    const existingEvents = await this.eventsRepository
      .createQueryBuilder('event')
      .select('event.objectId', 'notificationId')
      .addSelect('event.targetId', 'deviceId')
      .where('event.type = :type', { type: EventType.NOTIFICATION_ACK })
      .andWhere('event.objectId IN (:...notificationIds)', {
        notificationIds,
      })
      .andWhere('event.targetId IN (:...deviceIds)', { deviceIds })
      .getRawMany();

    // Filter to only include events that match valid (notificationId, deviceId) pairs
    const existingNotificationIds = existingEvents
      .filter((e) =>
        validPairs.has(`${e.notificationId}:${e.deviceId}`),
      )
      .map((e) => e.notificationId as string);

    return new Set(existingNotificationIds);
  }

  /**
   * Get push modes for all platforms
   */
  private async getPushModes(): Promise<{
    apnMode: string;
    firebaseMode: string;
    webMode: string;
  }> {
    const apnMode = (await this.serverSettingsService.getStringValue(
      ServerSettingType.ApnPush,
      'Off',
    )) || 'Off';
    const firebaseMode = (await this.serverSettingsService.getStringValue(
      ServerSettingType.FirebasePush,
      'Off',
    )) || 'Off';
    const webMode = (await this.serverSettingsService.getStringValue(
      ServerSettingType.WebPush,
      'Off',
    )) || 'Off';

    return { apnMode, firebaseMode, webMode };
  }

  /**
   * Initialize push services based on server settings
   */
  private async initializePushServices(): Promise<void> {
    try {
      const forceActive = this.configService.get('FORCE_ACTIVE_PUSH_NOTIFICATIONS') === 'true';
      const { apnMode, firebaseMode, webMode } = await this.getPushModes();

      // Initialize iOS Push Service if enabled
      if (apnMode === 'Onboard' || forceActive) {
        this.logger.log('Initializing iOS Push Service (APNs)...');
        try {
          // Trigger initialization by accessing private method through ensureInitialized
          await (this.iosPushService as any).ensureInitialized();
          this.logger.log('iOS Push Service initialized successfully');
        } catch (error) {
          this.logger.error('Failed to initialize iOS Push Service:', error);
        }
      } else {
        this.logger.log(`iOS Push Service mode: ${apnMode} (skipping initialization)`);
      }

      // Initialize Firebase Push Service if enabled
      if (firebaseMode === 'Onboard' || forceActive) {
        this.logger.log('Initializing Firebase Push Service...');
        try {
          await (this.firebasePushService as any).ensureInitialized();
          this.logger.log('Firebase Push Service initialized successfully');
        } catch (error) {
          this.logger.error('Failed to initialize Firebase Push Service:', error);
        }
      } else {
        this.logger.log(`Firebase Push Service mode: ${firebaseMode} (skipping initialization)`);
      }

      // Initialize Web Push Service if enabled
      if (webMode === 'Onboard' || forceActive) {
        this.logger.log('Initializing Web Push Service...');
        try {
          await (this.webPushService as any).ensureInitialized();
          this.logger.log('Web Push Service initialized successfully');
        } catch (error) {
          this.logger.error('Failed to initialize Web Push Service:', error);
        }
      } else {
        this.logger.log(`Web Push Service mode: ${webMode} (skipping initialization)`);
      }

      this.logger.log('Push notification services initialization completed');
    } catch (error) {
      this.logger.error('Error during push services initialization:', error);
    }
  }

  async findByUser(userId: string): Promise<Notification[]> {
    const notifications = await this.notificationsRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      .leftJoinAndSelect('notification.message', 'message')
      .leftJoinAndSelect('message.bucket', 'bucket')
      .leftJoinAndSelect('notification.userDevice', 'userDevice')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .getMany();

    return this.urlBuilderService.processNotifications(notifications);
  }

  async findOne(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id, userId },
      relations: ['user', 'message', 'message.bucket', 'userDevice'],
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return this.urlBuilderService.processNotifications([notification])[0];
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.findOne(id, userId);
    const readAt = new Date();

    // Mark the specific notification as read
    notification.readAt = readAt;

    // If the notification already belongs to a device but was never marked as received,
    // mark it as received as well (client-side read implies it was shown on the device)
    if (notification.userDeviceId && !notification.receivedAt) {
      notification.receivedAt = readAt;
    }

    await this.notificationsRepository.save(notification);

    // Track NOTIFICATION_ACK event if it doesn't exist for this device/notification
    if (notification.userDeviceId) {
      const hasAckEvent = await this.hasNotificationAckEvent(notification.id, notification.userDeviceId);
      if (!hasAckEvent) {
        await this.eventTrackingService.trackNotificationAck(
          userId,
          notification.userDeviceId,
          notification.id,
        );
      }
    }

    // Find and mark all other notifications from the same message as read
    const relatedNotifications = await this.notificationsRepository.find({
      where: {
        userId,
        message: { id: notification.message.id },
        readAt: IsNull(),
      },
      relations: ['message'],
    });

    if (relatedNotifications.length > 0) {
      const relatedIds = relatedNotifications.map((n) => n.id);

      // Mark related notifications as read
      await this.notificationsRepository.update(
        { id: In(relatedIds) },
        { readAt },
      );

      // For related notifications that already have a device assigned but no receivedAt,
      // mark them as received as well
      await this.notificationsRepository
        .createQueryBuilder()
        .update(Notification)
        .set({ receivedAt: readAt })
        .where('id IN (:...ids)', { ids: relatedIds })
        .andWhere('"userDeviceId" IS NOT NULL')
        .andWhere('"receivedAt" IS NULL')
        .execute();

      this.logger.log(
        `Marked ${relatedNotifications.length} related notifications as read (and received when applicable) for user ${userId}`,
      );
    }

    // Cancel ALL reminders for this message (for all users)
    try {
      await this.reminderService.cancelRemindersByMessage(
        notification.message.id,
      );
    } catch (error) {
      this.logger.error(
        `Failed to cancel reminders for message ${notification.message.id}`,
        error,
      );
    }

    this.logger.log(
      `Notification ${id} and related notifications marked as read for user ${userId}`,
    );

    return this.findOne(id, userId);
  }

  async countRelatedUnreadNotifications(
    messageId: string,
    userId: string,
  ): Promise<number> {
    const count = await this.notificationsRepository.count({
      where: {
        userId,
        message: { id: messageId },
        readAt: IsNull(),
      },
      relations: ['message'],
    });
    return count;
  }

  async markAsUnread(id: string, userId: string): Promise<Notification> {
    const notification = await this.findOne(id, userId);
    notification.readAt = undefined;

    const updated = await this.notificationsRepository.save(notification);
    this.logger.log(`Notification ${id} marked as unread for user ${userId}`);

    return this.findOne(id, userId);
  }

  async markNotificationsAsUnreadBatch(
    ids: string[],
    userId: string,
  ): Promise<{ notifications: Notification[]; updatedCount: number }> {
    if (ids.length === 0) {
      return { notifications: [], updatedCount: 0 };
    }

    // Verify all notifications belong to the user
    const notifications = await this.notificationsRepository.find({
      where: { id: In(ids), userId },
      relations: ['message', 'message.bucket', 'userDevice'],
    });

    if (notifications.length === 0) {
      this.logger.warn(
        `No notifications found for user ${userId} with provided IDs`,
      );
      return { notifications: [], updatedCount: 0 };
    }

    if (notifications.length !== ids.length) {
      this.logger.warn(
        `Only ${notifications.length} of ${ids.length} notifications found for user ${userId}`,
      );
    }

    // Mark all specified notifications as unread in batch
    const updateResult = await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'NULL' })
      .where('id IN (:...ids)', { ids: notifications.map((n) => n.id) })
      .andWhere('userId = :userId', { userId })
      .execute();

    const updatedCount = updateResult.affected || 0;

    // Reload updated notifications to return complete data
    const updatedNotifications = await this.notificationsRepository.find({
      where: { id: In(notifications.map((n) => n.id)), userId },
      relations: ['message', 'message.bucket', 'userDevice'],
    });

    this.logger.log(
      `Batch marked ${updatedCount} notifications as unread for user ${userId}`,
    );

    return {
      notifications: updatedNotifications,
      updatedCount,
    };
  }

  async markNotificationsAsReadBatch(
    ids: string[],
    userId: string,
  ): Promise<{ notifications: Notification[]; updatedCount: number }> {
    if (ids.length === 0) {
      return { notifications: [], updatedCount: 0 };
    }

    const readAt = new Date();

    // First, verify all notifications belong to the user and get their message IDs
    const notifications = await this.notificationsRepository.find({
      where: { id: In(ids), userId },
      relations: ['message'],
    });

    if (notifications.length === 0) {
      this.logger.warn(
        `No notifications found for user ${userId} with provided IDs`,
      );
      return { notifications: [], updatedCount: 0 };
    }

    if (notifications.length !== ids.length) {
      this.logger.warn(
        `Only ${notifications.length} of ${ids.length} notifications found for user ${userId}`,
      );
    }

    // Get unique message IDs from the notifications to mark
    const messageIds = new Set(
      notifications.map((n) => n.message?.id).filter(Boolean),
    );

    const notificationIds = notifications.map((n) => n.id);

    // Mark the specified notifications as read
    const updateResult = await this.notificationsRepository.update(
      { id: In(notificationIds), userId, readAt: IsNull() },
      { readAt },
    );

    let updatedCount = updateResult.affected || 0;

    // Find and mark all related notifications from the same messages as read
    const relatedNotifications = await this.notificationsRepository.find({
      where: {
        userId,
        message: { id: In(Array.from(messageIds)) },
        readAt: IsNull(),
      },
      relations: ['message'],
    });

    // Filter out notifications that are already in the original list
    const originalNotificationIds = new Set(notificationIds);
    const newRelatedNotifications = relatedNotifications.filter(
      (n) => !originalNotificationIds.has(n.id),
    );

    if (newRelatedNotifications.length > 0) {
      const relatedIds = newRelatedNotifications.map((n) => n.id);
      const relatedUpdateResult = await this.notificationsRepository.update(
        { id: In(relatedIds) },
        { readAt },
      );
      updatedCount += relatedUpdateResult.affected || 0;
      this.logger.log(
        `Marked ${newRelatedNotifications.length} related notifications as read for user ${userId}`,
      );
    }

    // After marking notifications as read, also mark them as received where appropriate:
    // any notification (original or related) that has a userDeviceId but no receivedAt yet.
    const allIdsForReceivedUpdate = Array.from(messageIds).length
      ? await this.notificationsRepository
          .createQueryBuilder('n')
          .select('n.id')
          .where('n.userId = :userId', { userId })
          .andWhere('n.messageId IN (:...messageIds)', {
            messageIds: Array.from(messageIds),
          })
          .getMany()
      : [];

    const idsWithDeviceToMarkReceived = allIdsForReceivedUpdate
      .map((n) => n.id)
      .filter(Boolean);

    if (idsWithDeviceToMarkReceived.length > 0) {
      await this.notificationsRepository
        .createQueryBuilder()
        .update(Notification)
        .set({ receivedAt: readAt })
        .where('id IN (:...ids)', { ids: idsWithDeviceToMarkReceived })
        .andWhere('"userDeviceId" IS NOT NULL')
        .andWhere('"receivedAt" IS NULL')
        .execute();
    }

    // Track NOTIFICATION_ACK events for device notifications in batch
    const deviceNotifications = notifications.filter(
      (n): n is Notification & { userDeviceId: string } => !!n.userDeviceId,
    );
    if (deviceNotifications.length > 0) {
      // Check in batch which notifications already have ACK events
      const existingAckNotificationIds =
        await this.getExistingAckEventNotificationIds(deviceNotifications);

      // Create ACK events in batch for notifications that don't have them yet
      const eventsToCreate = deviceNotifications
        .filter(
          (n) =>
            n.userDeviceId &&
            !existingAckNotificationIds.has(n.id),
        )
        .map((n) =>
          this.eventsRepository.create({
            type: EventType.NOTIFICATION_ACK,
            userId,
            objectId: n.id,
            targetId: n.userDeviceId!,
          }),
        );

      if (eventsToCreate.length > 0) {
        // Use upsert to handle race conditions - ignore conflicts on unique index
        await this.eventsRepository
          .createQueryBuilder()
          .insert()
          .into('events')
          .values(eventsToCreate)
          .orIgnore() // Ignore duplicates based on unique index
          .execute();
        this.logger.log(
          `Created up to ${eventsToCreate.length} NOTIFICATION_ACK events in batch for user ${userId}`,
        );
      }
    }

    // Cancel reminders for all affected messages (for all users)
    if (messageIds.size > 0) {
      try {
        let totalCancelled = 0;
        for (const messageId of messageIds) {
          const cancelledCount =
            await this.reminderService.cancelRemindersByMessage(messageId);
          totalCancelled += cancelledCount;
        }
        if (totalCancelled > 0) {
          this.logger.log(
            `Cancelled ${totalCancelled} reminder(s) for ${messageIds.size} message(s) (all users) on batch mark as read`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to cancel reminders on batch mark as read`,
          error,
        );
      }
    }

    // Reload all updated notifications to return complete data
    const allUpdatedNotificationIds = [
      ...notifications.map((n) => n.id),
      ...newRelatedNotifications.map((n) => n.id),
    ];

    const updatedNotifications = await this.notificationsRepository.find({
      where: { id: In(allUpdatedNotificationIds), userId },
      relations: ['message', 'message.bucket', 'userDevice'],
    });

    if (updatedCount) {
      this.logger.log(
        `Batch marked ${updatedCount} notifications as read for user ${userId}`,
      );
    }

    return {
      notifications: updatedNotifications,
      updatedCount,
    };
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    // Get all unread notifications for this user to extract message IDs
    const unreadNotifications = await this.notificationsRepository.find({
      where: { userId, readAt: IsNull() },
      select: ['id', 'messageId'] as any,
      relations: ['message'],
    });

    const result = await this.notificationsRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    const updatedCount = result.affected || 0;
    this.logger.log(
      `Marked ${updatedCount} notifications as read for user ${userId}`,
    );

    // Cancel ALL reminders for all messages that were marked as read (for all users)
    if (unreadNotifications.length > 0) {
      try {
        const uniqueMessageIds = [...new Set(unreadNotifications.map(n => n.message?.id).filter(Boolean))];
        let totalCancelled = 0;
        for (const messageId of uniqueMessageIds) {
          const cancelledCount = await this.reminderService.cancelRemindersByMessage(messageId);
          totalCancelled += cancelledCount;
        }
        if (totalCancelled > 0) {
          this.logger.log(
            `Cancelled ${totalCancelled} reminder(s) for ${uniqueMessageIds.length} message(s) (all users) on mark all as read`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to cancel reminders on mark all as read`,
          error,
        );
      }
    } else if (!this.reminderService) {
      this.logger.warn('MessageReminderService not available - skipping reminder cancellation');
    }

    return { updatedCount };
  }

  /**
   * Mark all notifications older than the given notification as received (for the same user)
   */
  async updateReceivedUpTo(
    id: string,
    userId: string,
    deviceToken: string,
  ): Promise<{ updatedCount: number }> {
    this.logger.log(
      `updateReceivedUpTo called for user=${userId} with targetId=${id} and deviceToken=${deviceToken?.slice(
        0,
        8,
      )}...`,
    );

    const target = await this.findOne(id, userId);
    const device = await this.usersService.findDeviceByUserToken(
      userId,
      deviceToken,
    );
    if (!device) {
      this.logger.warn(
        `updateReceivedUpTo: device not found for user=${userId} token=${deviceToken?.slice(
          0,
          8,
        ) ?? 'undefined'}...`,
      );
      return { updatedCount: 0 };
    }
    const deviceId = device.id;

    const now = new Date();
    const qb = this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ receivedAt: now })
      .where('"userId" = :userId', { userId })
      .andWhere('"userDeviceId" = :userDeviceId', { userDeviceId: deviceId })
      .andWhere('( "createdAt" <= :createdAt OR "id" = :targetId )', {
        createdAt: target.createdAt,
        targetId: target.id,
      })
      .andWhere('"receivedAt" IS NULL');

    const result = await qb.execute();
    const updatedCount = result.affected || 0;

    this.logger.log(
      `updateReceivedUpTo: set receivedAt for ${updatedCount} notification(s) on device=${deviceId} (up to notification=${target.id}) for user=${userId}`,
    );

    // Track NOTIFICATION_ACK event for the target notification if it doesn't exist
    const hasAckEvent = await this.hasNotificationAckEvent(target.id, deviceId);
    if (!hasAckEvent) {
      await this.eventTrackingService.trackNotificationAck(
        userId,
        deviceId,
        target.id,
      );
    }

    return { updatedCount };
  }

  async remove(id: string, userId: string): Promise<void> {
    const notification = await this.findOne(id, userId);

    // Track NOTIFICATION_ACK event if it doesn't exist for this device/notification
    if (notification.userDeviceId) {
      const hasAckEvent = await this.hasNotificationAckEvent(notification.id, notification.userDeviceId);
      if (!hasAckEvent) {
        await this.eventTrackingService.trackNotificationAck(
          userId,
          notification.userDeviceId,
          notification.id,
        );
      }
    }

    // Cancel ALL reminders for this message (for all users)
    if (this.reminderService) {
      try {
        await this.reminderService.cancelRemindersByMessage(
          notification.message.id,
        );
      } catch (error) {
        this.logger.error(
          `Failed to cancel reminders for message ${notification.message.id} on delete`,
          error,
        );
      }
    }

    await this.notificationsRepository.remove(notification);
  }

  /**
   * Remove many notifications by ids for a specific user.
   * Silently skips ids that don't exist or don't belong to the user.
   */
  async removeMany(
    ids: string[],
    userId: string,
  ): Promise<{ deletedIds: string[] }> {
    if (!ids?.length) return { deletedIds: [] };

    // Find only existing notifications for this user with message relation
    const existing = await this.notificationsRepository.find({
      where: ids.map((id) => ({ id, userId }) as any),
      select: { id: true, message: { id: true } } as any,
      relations: ['message'],
    });
    const existingIds = existing.map((n) => n.id);
    if (existingIds.length === 0) return { deletedIds: [] };

    // Get unique message IDs to cancel reminders
    const messageIds = [...new Set(existing.map((n) => n.message?.id).filter(Boolean))];

    // Cancel ALL reminders for these messages (for all users)
    if (this.reminderService && messageIds.length > 0) {
      try {
        let totalCancelled = 0;
        for (const messageId of messageIds) {
          const cancelledCount = await this.reminderService.cancelRemindersByMessage(
            messageId,
          );
          totalCancelled += cancelledCount;
        }
        if (totalCancelled > 0) {
          this.logger.log(
            `Cancelled ${totalCancelled} reminder(s) for ${messageIds.length} message(s) (all users) on bulk delete`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to cancel reminders for messages on bulk delete`,
          error,
        );
      }
    }

    // Delete by ids using query for efficiency
    await this.notificationsRepository
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('"userId" = :userId', { userId })
      .andWhere('id IN (:...ids)', { ids: existingIds })
      .execute();

    this.logger.log(
      `Removed ${existingIds.length} notifications for user ${userId}`,
    );
    return { deletedIds: existingIds };
  }

  async markAsSent(id: string, userId: string): Promise<Notification> {
    const notification = await this.findOne(id, userId);
    notification.sentAt = new Date();
    return this.notificationsRepository.save(notification);
  }

  /**
   * Update notification receivedAt and userDeviceId when received by a specific device
   */
  async markAsReceived(
    id: string,
    userId: string,
    userDeviceId: string,
  ): Promise<Notification> {
    // Verify device ownership
    const device = await this.usersService.findDeviceById(userDeviceId);
    if (!device || device.userId !== userId) {
      throw new ForbiddenException('Access denied: device not owned by user');
    }

    const notification = await this.findOne(id, userId);
    notification.receivedAt = new Date();
    notification.userDeviceId = userDeviceId;

    const updated = await this.notificationsRepository.save(notification);
    this.logger.log(
      `Notification ${id} marked as received by device ${userDeviceId} for user ${userId}`,
    );

    return this.findOne(id, userId);
  }

  /**
   * Mark a specific notification as received resolving the device by token for the current user
   */
  async markAsReceivedByDeviceToken(
    id: string,
    userId: string,
    deviceToken: string,
  ): Promise<Notification> {
    const device = await this.usersService.findDeviceByUserToken(
      userId,
      deviceToken,
    );
    if (!device) {
      throw new NotFoundException('Device not found for provided token');
    }
    await this.usersService.updateDeviceLastUsed(device.id, userId);
    return this.markAsReceived(id, userId, device.id);
  }

  /**
   * Find notifications by user device
   */
  async findByUserDevice(
    userDeviceId: string,
    userId: string,
  ): Promise<Notification[]> {
    // Verify device ownership
    const device = await this.usersService.findDeviceById(userDeviceId);
    if (!device || device.userId !== userId) {
      throw new ForbiddenException('Access denied: device not owned by user');
    }

    const notifications = await this.notificationsRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      .leftJoinAndSelect('notification.message', 'message')
      .leftJoinAndSelect('message.bucket', 'bucket')
      .leftJoinAndSelect('notification.userDevice', 'userDevice')
      .where('notification.userDeviceId = :userDeviceId', { userDeviceId })
      .orderBy('notification.createdAt', 'DESC')
      .getMany();

    return this.urlBuilderService.processNotifications(notifications);
  }

  /**
   * Find notifications by user and device token
   */
  async findByUserDeviceToken(
    userId: string,
    deviceToken: string,
  ): Promise<Notification[]> {
    const device = await this.usersService.findDeviceByUserToken(
      userId,
      deviceToken,
    );

    if (!device) {
      this.logger.error(
        `Device not found for user ${userId} with the provided token ${deviceToken}`,
      );
      throw new NotFoundException('Device not found');
    }

    return this.findByUserDevice(device.id, userId);
  }

  /**
   * Get all available notification services for all platforms
   */
  async getNotificationServices(): Promise<NotificationServiceInfo[]> {
    const services: NotificationServiceInfo[] = [];
    const { apnMode, firebaseMode, webMode } = await this.getPushModes();

    // iOS Platform
    // Onboard or Passthrough = use server push services
    // Local = device-only notifications
    // Off = no notifications at all
    if (apnMode === 'Onboard' || apnMode === 'Passthrough') {
      // Check if iOS push service is properly initialized
      if (apnMode === 'Passthrough' || (this.iosPushService && (this.iosPushService as any).provider)) {
        services.push({
          devicePlatform: DevicePlatform.IOS,
          service: NotificationServiceType.PUSH,
        });
      }
    } else if (apnMode === 'Local') {
      services.push({
        devicePlatform: DevicePlatform.IOS,
        service: NotificationServiceType.LOCAL,
      });
    }
    // If 'Off', don't add any service for this platform

    // Android Platform
    if (firebaseMode === 'Onboard' || firebaseMode === 'Passthrough') {
      // Check if Firebase push service is properly initialized
      if (firebaseMode === 'Passthrough' || (this.firebasePushService && (this.firebasePushService as any).app)) {
        services.push({
          devicePlatform: DevicePlatform.ANDROID,
          service: NotificationServiceType.PUSH,
        });
      }
    } else if (firebaseMode === 'Local') {
      services.push({
        devicePlatform: DevicePlatform.ANDROID,
        service: NotificationServiceType.LOCAL,
      });
    }
    // If 'Off', don't add any service for this platform

    // Web Platform
    if (webMode === 'Onboard' || webMode === 'Passthrough') {
      // Check if Web push service is properly initialized
      if (webMode === 'Passthrough' || (this.webPushService && (this.webPushService as any).configured)) {
        services.push({
          devicePlatform: DevicePlatform.WEB,
          service: NotificationServiceType.PUSH,
        });
      }
    } else if (webMode === 'Local') {
      services.push({
        devicePlatform: DevicePlatform.WEB,
        service: NotificationServiceType.LOCAL,
      });
    }
    // If 'Off', don't add any service for this platform

    return services;
  }

  /**
   * Send prebuilt payloads (as-is) from passthrough entrypoint.
   */
  async sendPrebuilt(
    body: ExternalNotifyRequestDto,
  ): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Processing sendPrebuilt for platform: ${body.platform}`);

    if (body.platform === ExternalPlatform.IOS) {
      this.logger.log(
        `Sending iOS prebuilt notification to token: ${(body.deviceData as ExternalDeviceDataIosDto).token}`,
      );
      const res = await this.iosPushService.sendPrebuilt(
        body
      );
      this.logger.log(`iOS sendPrebuilt result: ${JSON.stringify(res)}`);
      return { success: res.success };
    }

    if (body.platform === ExternalPlatform.ANDROID) {
      const res = await this.firebasePushService.sendPrebuilt(
        body.deviceData as ExternalDeviceDataFcmDto,
        body.payload,
      );
      return { success: res.success };
    }

    if (body.platform === ExternalPlatform.WEB) {
      const res = await this.webPushService.sendPrebuilt(
        body.deviceData as ExternalDeviceDataWebDto,
        body.payload,
      );
      return { success: res.success };
    }

    return { success: false, message: 'Unsupported platform' };
  }
}
