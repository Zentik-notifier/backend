import { Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtOrAccessTokenGuard } from '../../auth/guards/jwt-or-access-token.guard';
import { Notification } from '../../entities/notification.entity';
import { 
  NotificationsPerUserDailyView,
  NotificationsPerUserWeeklyView,
  NotificationsPerUserMonthlyView,
  NotificationsPerUserAllTimeView
} from '../../entities/views/notifications-analytics.views';
import { NotificationServiceInfo } from '../../notifications/dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { PushNotificationOrchestratorService } from '../../notifications/push-orchestrator.service';
import { UsersService } from '../../users/users.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { DeviceToken } from '../decorators/device-token.decorator';
import { GraphQLSubscriptionService } from '../services/graphql-subscription.service';

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
  thisMonth: number;

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
    private usersService: UsersService,
    private subscriptionService: GraphQLSubscriptionService,
    private pushOrchestrator: PushNotificationOrchestratorService,
    @InjectRepository(NotificationsPerUserDailyView)
    private dailyViewRepository: Repository<NotificationsPerUserDailyView>,
    @InjectRepository(NotificationsPerUserWeeklyView)
    private weeklyViewRepository: Repository<NotificationsPerUserWeeklyView>,
    @InjectRepository(NotificationsPerUserMonthlyView)
    private monthlyViewRepository: Repository<NotificationsPerUserMonthlyView>,
    @InjectRepository(NotificationsPerUserAllTimeView)
    private allTimeViewRepository: Repository<NotificationsPerUserAllTimeView>,
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

  @Query(() => UserNotificationStats)
  async userNotificationStats(
    @CurrentUser('id') currentUserId: string,
    @Args('userId', { nullable: true }) userId?: string,
  ): Promise<UserNotificationStats> {
    // Use provided userId or current user's id
    const targetUserId = userId || currentUserId;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now);
    thisWeek.setDate(now.getDate() - now.getDay()); // Start of current week
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calculate stats directly from notifications table since materialized views might not be updated
    const notifications = await this.notificationsService.findByUser(targetUserId);
    
    // Filter notifications that have been sent
    const sentNotifications = notifications.filter(n => n.sentAt);
    
    // Count notifications by period
    const todayCount = sentNotifications.filter(n => {
      const sentDate = new Date(n.sentAt!);
      return sentDate >= today && sentDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }).length;

    const weekCount = sentNotifications.filter(n => {
      const sentDate = new Date(n.sentAt!);
      return sentDate >= thisWeek;
    }).length;

    const monthCount = sentNotifications.filter(n => {
      const sentDate = new Date(n.sentAt!);
      return sentDate >= thisMonth;
    }).length;

    const totalCount = sentNotifications.length;

    return {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      total: totalCount,
    };
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
    let deletedCount = 0;

    for (const id of ids) {
      try {
        await this.notificationsService.remove(id, userId);
        await this.subscriptionService.publishNotificationDeleted(id, userId);
        deletedCount++;
      } catch (error) {
        this.logger.error(`Failed to delete notification ${id}:`, error);
      }
    }

    return {
      deletedCount,
      success: true,
    };
  }

  @Mutation(() => MassMarkResult)
  async massMarkNotificationsAsRead(
    @Args('ids', { type: () => [String] }) ids: string[],
    @CurrentUser('id') userId: string,
  ): Promise<MassMarkResult> {
    let updatedCount = 0;

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
        updatedCount++;
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
}
