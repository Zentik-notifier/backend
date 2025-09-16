import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Event, EventType } from '../entities';
import { EventsService } from './events.service';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/users.types';

@ApiTags('Events')
@Controller('events')
@UseGuards(AdminOnlyGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll(): Promise<Event[]> {
    return this.eventsService.findAll();
  }

  @Get('count')
  async getEventCount(): Promise<{ count: number }> {
    const count = await this.eventsService.getEventCount();
    return { count };
  }

  @Get('by-type')
  async findByType(@Query('type') type: EventType): Promise<Event[]> {
    return this.eventsService.findByType(type);
  }

  @Get('by-user')
  async findByUserId(@Query('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findByUserId(userId);
  }

  @Get('by-object')
  async findByObjectId(@Query('objectId') objectId: string): Promise<Event[]> {
    return this.eventsService.findByObjectId(objectId);
  }

  // Endpoint REST per le statistiche delle notifiche per bucket per utente
  @Get('bucket-user/daily')
  @UseGuards(JwtOrAccessTokenGuard)
  async getNotificationsPerBucketUserDaily(
    @Query('bucketId') bucketId: string,
    @Query('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own notification statistics');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.eventsService.getEventsPerBucketUserDaily(bucketId, userId, start, end);
  }

  @Get('bucket-user/weekly')
  @UseGuards(JwtOrAccessTokenGuard)
  async getNotificationsPerBucketUserWeekly(
    @Query('bucketId') bucketId: string,
    @Query('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own notification statistics');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.eventsService.getEventsPerBucketUserWeekly(bucketId, userId, start, end);
  }

  @Get('bucket-user/monthly')
  @UseGuards(JwtOrAccessTokenGuard)
  async getNotificationsPerBucketUserMonthly(
    @Query('bucketId') bucketId: string,
    @Query('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own notification statistics');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.eventsService.getEventsPerBucketUserMonthly(bucketId, userId, start, end);
  }

  @Get('bucket-user/all-time')
  @UseGuards(JwtOrAccessTokenGuard)
  async getNotificationsPerBucketUserAllTime(
    @Query('bucketId') bucketId: string,
    @Query('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own notification statistics');
    }
    
    return this.eventsService.getEventsPerBucketUserAllTime(bucketId, userId);
  }

  @Get('bucket-user/stats')
  @UseGuards(JwtOrAccessTokenGuard)
  async getBucketUserNotificationStats(
    @Query('bucketId') bucketId: string,
    @Query('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Admin può vedere tutto, non-admin solo i propri dati
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      throw new ForbiddenException('You can only access your own notification statistics');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.eventsService.getBucketUserEventStats(bucketId, userId, start, end);
  }
}
