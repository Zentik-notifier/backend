import { Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Subscription
} from '@nestjs/graphql';
import { isAfter, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { EventType } from '../entities/event.entity';
import { NotificationPostpone } from '../entities/notification-postpone.entity';
import { Notification } from '../entities/notification.entity';
import { EventsService } from '../events/events.service';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { DeviceToken } from '../graphql/decorators/device-token.decorator';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { NotificationServiceInfo } from './dto';
import { PostponeNotificationDto, PostponeResponseDto } from './dto/postpone-notification.dto';
import { NotificationPostponeService } from './notification-postpone.service';
import { NotificationsService } from './notifications.service';

@ObjectType()
export class MarkAllAsReadResult {
  @Field()
  updatedCount: number;

  @Field()
  success: boolean;
}

@ObjectType()
export class UpdateReceivedResult {
  @Field()
  updatedCount: number;

  @Field()
  success: boolean;
}

@ObjectType()
export class MassDeleteResult {
  @Field()
  deletedCount: number;

  @Field()
  success: boolean;
}

@ObjectType()
export class MassMarkResult {
  @Field()
  updatedCount: number;

  @Field()
  success: boolean;
}

@ObjectType()
export class UserNotificationStats {
  @Field()
  today: number;

  @Field()
  thisWeek: number;

  @Field()
  last7Days: number;

  @Field()
  thisMonth: number;

  @Field()
  last30Days: number;

  @Field()
  total: number;
}

@Resolver(() => Notification)
@UseGuards(JwtOrAccessTokenGuard)
@Injectable()
export class NotificationsResolver {
  private readonly logger = new Logger('NotificationsResolver');

  constructor(
    private notificationsService: NotificationsService,
    private postponeService: NotificationPostponeService,
    private subscriptionService: GraphQLSubscriptionService,
    private eventsService: EventsService,
  ) {}

  @Query(() => [Notification])
  async notifications(
    @DeviceToken() deviceToken: string,
    @CurrentUser('id') userId: string,
  ): Promise<Notification[]> {
    return this.notificationsService.findByUserDeviceToken(userId, deviceToken);
  }

  @Query(() => Notification)
  async notification(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Notification> {
    return this.notificationsService.findOne(id, userId);
  }

  @Query(() => [NotificationServiceInfo])
  async notificationServices() {
    return this.notificationsService.getNotificationServices();
  }

  @Mutation(() => Boolean)
  async deleteNotification(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.notificationsService.remove(id, userId);

    // Publish to subscriptions
    await this.subscriptionService.publishNotificationDeleted(id, userId);

    return true;
  }

  @Mutation(() => Notification)
  async markNotificationAsRead(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Notification> {
    const notification = await this.notificationsService.markAsRead(id, userId);

    // Publish to subscriptions
    await this.subscriptionService.publishNotificationUpdated(
      notification,
      userId,
    );

    return notification;
  }

  @Mutation(() => Notification)
  async markNotificationAsUnread(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Notification> {
    const notification = await this.notificationsService.markAsUnread(
      id,
      userId,
    );

    // Publish to subscriptions
    await this.subscriptionService.publishNotificationUpdated(
      notification,
      userId,
    );

    return notification;
  }

  @Mutation(() => Notification)
  async markNotificationAsReceived(
    @Args('id') id: string,
    @Args('userDeviceId') userDeviceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<Notification> {
    const notification = await this.notificationsService.markAsReceived(
      id,
      userId,
      userDeviceId,
    );

    // Publish to subscriptions
    await this.subscriptionService.publishNotificationUpdated(
      notification,
      userId,
    );

    return notification;
  }

  @Mutation(() => Notification)
  async deviceReportNotificationReceived(
    @Args('id') id: string,
    @DeviceToken() deviceToken: string,
    @CurrentUser('id') userId: string,
  ): Promise<Notification> {
    const notification =
      await this.notificationsService.markAsReceivedByDeviceToken(
        id,
        userId,
        deviceToken,
      );
    await this.subscriptionService.publishNotificationUpdated(
      notification,
      userId,
    );
    return notification;
  }

  @Mutation(() => MarkAllAsReadResult)
  async markAllNotificationsAsRead(
    @CurrentUser('id') userId: string,
  ): Promise<MarkAllAsReadResult> {
    const result = await this.notificationsService.markAllAsRead(userId);

    return {
      updatedCount: result.updatedCount,
      success: true,
    };
  }

  @Mutation(() => UpdateReceivedResult)
  async updateReceivedNotifications(
    @Args('id') id: string,
    @DeviceToken() deviceToken: string,
    @CurrentUser('id') userId: string,
  ): Promise<UpdateReceivedResult> {
    const result = await this.notificationsService.updateReceivedUpTo(
      id,
      userId,
      deviceToken,
    );
    return {
      updatedCount: result.updatedCount,
      success: true,
    };
  }

  // Subscriptions - these still need access to context for WebSocket filtering
  @Subscription(() => Notification, {
    filter: (payload, variables, context) => {
      // Only send notifications to the user who owns them
      const userId = context?.req?.user?.id;
      return userId && payload.userId === userId;
    },
  })
  notificationCreated() {
    return this.subscriptionService.notificationCreated();
  }

  @Subscription(() => Notification, {
    filter: (payload, variables, context) => {
      const userId = context?.req?.user?.id;
      return userId && payload.userId === userId;
    },
  })
  notificationUpdated() {
    return this.subscriptionService.notificationUpdated();
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      const userId = context?.req?.user?.id;
      return userId && payload.userId === userId;
    },
  })
  notificationDeleted() {
    return this.subscriptionService.notificationDeleted();
  }

  @Mutation(() => MassDeleteResult)
  async massDeleteNotifications(
    @Args('ids', { type: () => [String] }) ids: string[],
    @CurrentUser('id') userId: string,
  ): Promise<MassDeleteResult> {
    const { deletedIds } = await this.notificationsService.removeMany(
      ids,
      userId,
    );
    // Publish deletions only for actually deleted ids
    for (const id of deletedIds) {
      await this.subscriptionService.publishNotificationDeleted(id, userId);
    }
    return { deletedCount: deletedIds.length, success: true };
  }

  @Mutation(() => MassMarkResult)
  async massMarkNotificationsAsRead(
    @Args('ids', { type: () => [String] }) ids: string[],
    @CurrentUser('id') userId: string,
  ): Promise<MassMarkResult> {
    let updatedCount = 0;
    const processedMessageIds = new Set<string>();

    for (const id of ids) {
      try {
        const notification = await this.notificationsService.markAsRead(
          id,
          userId,
        );
        await this.subscriptionService.publishNotificationUpdated(
          notification,
          userId,
        );

        // Count the main notification
        updatedCount++;

        // Track message IDs to avoid double counting related notifications
        if (!processedMessageIds.has(notification.message.id)) {
          processedMessageIds.add(notification.message.id);

          // Count related notifications from the same message
          const relatedCount =
            await this.notificationsService.countRelatedUnreadNotifications(
              notification.message.id,
              userId,
            );
          updatedCount += relatedCount;
        }
      } catch (error) {
        this.logger.error(`Failed to mark notification ${id} as read:`, error);
      }
    }

    return {
      updatedCount,
      success: true,
    };
  }

  @Mutation(() => MassMarkResult)
  async massMarkNotificationsAsUnread(
    @Args('ids', { type: () => [String] }) ids: string[],
    @CurrentUser('id') userId: string,
  ): Promise<MassMarkResult> {
    let updatedCount = 0;

    for (const id of ids) {
      try {
        const notification = await this.notificationsService.markAsUnread(
          id,
          userId,
        );
        await this.subscriptionService.publishNotificationUpdated(
          notification,
          userId,
        );
        updatedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to mark notification ${id} as unread:`,
          error,
        );
      }
    }

    return {
      updatedCount,
      success: true,
    };
  }

  @Query(() => UserNotificationStats)
  async userNotificationStats(
    @CurrentUser('id') currentUserId: string,
    @Args('userId', { nullable: true }) userId?: string,
  ): Promise<UserNotificationStats> {
    // Use provided userId or current user's id
    const targetUserId = userId || currentUserId;
    const now = new Date();
    const today = startOfDay(now);
    const thisWeek = startOfWeek(now, { weekStartsOn: 1 }); // Monday as start of week
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 7);
    const thisMonth = startOfMonth(now);
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);

    const events = await this.eventsService.findByUserId(targetUserId);

    // Filter events that represent notifications (MESSAGE type events)
    const notificationEvents = events.filter(
      (e) => e.type === EventType.NOTIFICATION,
    );

    // Count events by period using date-fns
    const todayCount = notificationEvents.filter((e) => {
      const eventDate = new Date(e.createdAt);
      return (
        isAfter(eventDate, today) || eventDate.getTime() === today.getTime()
      );
    }).length;

    const weekCount = notificationEvents.filter((e) => {
      const eventDate = new Date(e.createdAt);
      return (
        isAfter(eventDate, thisWeek) ||
        eventDate.getTime() === thisWeek.getTime()
      );
    }).length;

    const last7DaysCount = notificationEvents.filter((e) => {
      const eventDate = new Date(e.createdAt);
      return (
        isAfter(eventDate, last7Days) ||
        eventDate.getTime() === last7Days.getTime()
      );
    }).length;

    const monthCount = notificationEvents.filter((e) => {
      const eventDate = new Date(e.createdAt);
      return (
        isAfter(eventDate, thisMonth) ||
        eventDate.getTime() === thisMonth.getTime()
      );
    }).length;

    const last30DaysCount = notificationEvents.filter((e) => {
      const eventDate = new Date(e.createdAt);
      return (
        isAfter(eventDate, last30Days) ||
        eventDate.getTime() === last30Days.getTime()
      );
    }).length;

    const totalCount = notificationEvents.length;

    this.logger.debug(
      `User ${targetUserId} stats: today=${todayCount}, week=${weekCount}, last7Days=${last7DaysCount}, month=${monthCount}, last30Days=${last30DaysCount}, total=${totalCount} (total events: ${notificationEvents.length})`,
    );

    return {
      today: todayCount,
      thisWeek: weekCount,
      last7Days: last7DaysCount,
      thisMonth: monthCount,
      last30Days: last30DaysCount,
      total: totalCount,
    };
  }

  @Mutation(() => PostponeResponseDto)
  async postponeNotification(
    @Args('input') input: PostponeNotificationDto,
    @CurrentUser('id') userId: string,
  ): Promise<PostponeResponseDto> {
    const postpone = await this.postponeService.createPostpone(
      input.notificationId,
      userId,
      input.minutes,
    );

    return {
      id: postpone.id,
      notificationId: postpone.notificationId,
      sendAt: postpone.sendAt,
      createdAt: postpone.createdAt,
    };
  }

  @Query(() => [NotificationPostpone])
  async pendingPostpones(
    @CurrentUser('id') userId: string,
  ): Promise<NotificationPostpone[]> {
    return this.postponeService.findPendingByUser(userId);
  }

  @Mutation(() => Boolean)
  async cancelPostpone(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    const result = await this.postponeService.cancelPostpone(id, userId);
    return result.success;
  }
}
