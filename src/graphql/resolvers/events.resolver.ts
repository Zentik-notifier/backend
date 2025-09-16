import { UseGuards, ForbiddenException } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../../auth/guards/admin-only.guard';
import {
  Event,
  EventType,
  NotificationsPerBucketUserDailyView,
  NotificationsPerBucketUserWeeklyView,
  NotificationsPerBucketUserMonthlyView,
  NotificationsPerBucketUserAllTimeView,
} from '../../entities';
import { EventsService } from '../../events/events.service';
import { JwtOrAccessTokenGuard } from 'src/auth/guards/jwt-or-access-token.guard';
import { CurrentUser, CurrentUserData } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/users.types';

@Resolver(() => Event)
@UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
export class EventsResolver {
  constructor(private readonly eventsService: EventsService) { }

  @Query(() => [Event])
  async events(): Promise<Event[]> {
    return this.eventsService.findAll();
  }

  @Query(() => Number)
  async eventCount(): Promise<number> {
    return this.eventsService.getEventCount();
  }

  @Query(() => [Event])
  async eventsByType(
    @Args('type', { type: () => EventType }) type: EventType,
  ): Promise<Event[]> {
    return this.eventsService.findByType(type);
  }

  @Query(() => [Event])
  async eventsByUser(@Args('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findByUserId(userId);
  }

  @Query(() => [Event])
  async eventsByObject(@Args('objectId') objectId: string): Promise<Event[]> {
    return this.eventsService.findByObjectId(objectId);
  }

  // Resolver per le statistiche delle notifiche per bucket per utente
  @Query(() => [NotificationsPerBucketUserDailyView])
  @UseGuards(JwtOrAccessTokenGuard)
  async notificationsPerBucketUserDaily(
    @Args('bucketId') bucketId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
  ): Promise<NotificationsPerBucketUserDailyView[]> {
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own notification statistics');
    }

    return this.eventsService.getNotificationsPerBucketUserDaily(bucketId, userId, startDate, endDate);
  }

  @Query(() => [NotificationsPerBucketUserWeeklyView])
  @UseGuards(JwtOrAccessTokenGuard)
  async notificationsPerBucketUserWeekly(
    @Args('bucketId') bucketId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
  ): Promise<NotificationsPerBucketUserWeeklyView[]> {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own notification statistics');
    }

    return this.eventsService.getNotificationsPerBucketUserWeekly(bucketId, userId, startDate, endDate);
  }

  @Query(() => [NotificationsPerBucketUserMonthlyView])
  @UseGuards(JwtOrAccessTokenGuard)
  async notificationsPerBucketUserMonthly(
    @Args('bucketId') bucketId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
  ): Promise<NotificationsPerBucketUserMonthlyView[]> {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own notification statistics');
    }

    return this.eventsService.getNotificationsPerBucketUserMonthly(bucketId, userId, startDate, endDate);
  }

  @Query(() => NotificationsPerBucketUserAllTimeView, { nullable: true })
  @UseGuards(JwtOrAccessTokenGuard)
  async notificationsPerBucketUserAllTime(
    @Args('bucketId') bucketId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
  ): Promise<NotificationsPerBucketUserAllTimeView | null> {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own notification statistics');
    }

    return this.eventsService.getNotificationsPerBucketUserAllTime(bucketId, userId);
  }
}
