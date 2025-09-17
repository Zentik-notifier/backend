import { UseGuards, ForbiddenException } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../../auth/guards/admin-only.guard';
import {
  Event,
  EventType,
  EventsPerBucketUserDailyView,
  EventsPerBucketUserWeeklyView,
  EventsPerBucketUserMonthlyView,
  EventsPerBucketUserAllTimeView,
} from '../../entities';
import { EventsService } from '../../events/events.service';
import { EventsQueryDto, EventsResponseDto, EventsPaginatedQueryDto } from '../../events/dto';
import { JwtOrAccessTokenGuard } from 'src/auth/guards/jwt-or-access-token.guard';
import { CurrentUser, CurrentUserData } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/users.types';

@Resolver(() => Event)
@UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
export class EventsResolver {
  constructor(private readonly eventsService: EventsService) { }

  @Query(() => EventsResponseDto)
  async events(@Args('query') query: EventsQueryDto): Promise<EventsResponseDto> {
    return this.eventsService.findAllPaginated(query);
  }

  // Resolver per le statistiche degli eventi per bucket per utente
  @Query(() => [EventsPerBucketUserDailyView])
  @UseGuards(JwtOrAccessTokenGuard)
  async eventsPerBucketUserDaily(
    @Args('bucketId') bucketId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
  ): Promise<EventsPerBucketUserDailyView[]> {
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own event statistics');
    }

    return this.eventsService.getEventsPerBucketUserDaily(bucketId, userId, startDate, endDate);
  }

  @Query(() => [EventsPerBucketUserWeeklyView])
  @UseGuards(JwtOrAccessTokenGuard)
  async eventsPerBucketUserWeekly(
    @Args('bucketId') bucketId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
  ): Promise<EventsPerBucketUserWeeklyView[]> {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own event statistics');
    }

    return this.eventsService.getEventsPerBucketUserWeekly(bucketId, userId, startDate, endDate);
  }

  @Query(() => [EventsPerBucketUserMonthlyView])
  @UseGuards(JwtOrAccessTokenGuard)
  async eventsPerBucketUserMonthly(
    @Args('bucketId') bucketId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
  ): Promise<EventsPerBucketUserMonthlyView[]> {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own event statistics');
    }

    return this.eventsService.getEventsPerBucketUserMonthly(bucketId, userId, startDate, endDate);
  }

  @Query(() => [EventsPerBucketUserAllTimeView])
  @UseGuards(JwtOrAccessTokenGuard)
  async eventsPerBucketUserAllTime(
    @Args('bucketId') bucketId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
  ): Promise<EventsPerBucketUserAllTimeView[]> {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own event statistics');
    }

    return this.eventsService.getEventsPerBucketUserAllTime(bucketId, userId);
  }
}
