import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EventTrackingService } from 'src/events/event-tracking.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireScopes } from '../auth/decorators/require-scopes.decorator';
import { AccessTokenScope } from '../auth/dto/auth.dto';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { Notification } from '../entities/notification.entity';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { GetSystemAccessToken } from '../system-access-token/decorators/get-system-access-token.decorator';
import { RequireSystemScopes } from '../system-access-token/decorators/require-system-scopes.decorator';
import { SystemAccessScopesGuard } from '../system-access-token/system-access-scopes.guard';
import { SystemAccessTokenStatsInterceptor } from '../system-access-token/system-access-token-stats.interceptor';
import { SystemAccessTokenGuard } from '../system-access-token/system-access-token.guard';
import { SystemAccessTokenService } from '../system-access-token/system-access-token.service';
import {
  DeviceReportReceivedDto,
  ExternalNotifyRequestDocDto,
  MarkReceivedDto,
  NotificationServicesInfoDto,
  UpdateReceivedUpToDto,
} from './dto';
import {
  ExternalNotifyRequestDto,
  ExternalNotifyResponseDto,
  IosDeliveryStrategy,
} from './dto/external-notify.dto';
import { PostponeNotificationDto, PostponeResponseDto } from './dto/postpone-notification.dto';
import {
  BatchDeleteWatchDto,
  BatchDeleteWatchResponseDto,
  BatchMarkReadWatchDto,
  BatchMarkUnreadWatchDto,
  BatchMarkWatchResponseDto,
} from './dto/batch-watch.dto';
import { NotificationPostponeService } from './notification-postpone.service';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtOrAccessTokenGuard)
@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth()
export class NotificationsController {
  private readonly logger = new Logger('NotificationsController');

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly postponeService: NotificationPostponeService,
    private readonly subscriptionService: GraphQLSubscriptionService,
    private readonly systemAccessTokenService: SystemAccessTokenService,
    private readonly eventsTrackingService: EventTrackingService,
  ) { }

  @Get()
  @ApiOperation({ summary: 'Get all notifications for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    type: [Notification],
  })
  findAll(@GetUser('id') userId: string) {
    return this.notificationsService.findByUser(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @GetUser('id') userId: string) {
    const notification = await this.notificationsService.markAsRead(id, userId);

    // Publish to GraphQL subscriptions
    try {
      await this.subscriptionService.publishNotificationUpdated(
        notification,
        userId,
      );
    } catch (error) {
      console.error(
        'Failed to publish notification updated subscription:',
        error,
      );
    }

    return notification;
  }

  @Patch(':id/unread')
  @ApiOperation({ summary: 'Mark notification as unread' })
  async markAsUnread(@Param('id') id: string, @GetUser('id') userId: string) {
    const notification = await this.notificationsService.markAsUnread(
      id,
      userId,
    );

    // Publish to GraphQL subscriptions
    try {
      await this.subscriptionService.publishNotificationUpdated(
        notification,
        userId,
      );
    } catch (error) {
      console.error(
        'Failed to publish notification updated subscription:',
        error,
      );
    }

    return notification;
  }

  @Patch('mark-all-read')
  @ApiOperation({
    summary: 'Mark all unread notifications as read for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read successfully',
  })
  markAllAsRead(@GetUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification details',
    type: Notification,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  findOne(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.notificationsService.findOne(id, userId);
  }

  @Patch(':id/sent')
  @ApiOperation({
    summary: 'Mark notification as sent (internal client acknowledgement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as sent',
    type: Notification,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsSent(@Param('id') id: string, @GetUser('id') userId: string) {
    const notification = await this.notificationsService.markAsSent(id, userId);

    // Publish to GraphQL subscriptions
    try {
      await this.subscriptionService.publishNotificationUpdated(
        notification,
        userId,
      );
    } catch (error) {
      console.error(
        'Failed to publish notification updated subscription:',
        error,
      );
    }

    return notification;
  }

  @Patch('update-received')
  @ApiOperation({
    summary:
      'Mark all notifications up to (and including) the given one as received for the resolved device',
  })
  @ApiBody({ type: UpdateReceivedUpToDto })
  @ApiResponse({
    status: 200,
    description: 'Notifications updated count',
    schema: {
      type: 'object',
      properties: { updatedCount: { type: 'number' } },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Missing id or deviceToken in request body',
  })
  async updateReceived(
    @Body() body: UpdateReceivedUpToDto,
    @GetUser('id') userId: string,
  ) {
    if (!body || !body.id || !body.deviceToken) {
      throw new BadRequestException(
        'Missing id or deviceToken in request body',
      );
    }
    return this.notificationsService.updateReceivedUpTo(
      body.id,
      userId,
      body.deviceToken,
    );
  }

  @Patch(':id/received')
  @ApiOperation({
    summary: 'Mark notification as received by a specific user device (ID)',
  })
  @ApiBody({ type: MarkReceivedDto })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as received',
    type: Notification,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing userDeviceId in request body',
  })
  @ApiResponse({ status: 403, description: 'Device not owned by user' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsReceived(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() body: MarkReceivedDto,
  ) {
    if (!body || !body.userDeviceId) {
      throw new BadRequestException('Missing userDeviceId in request body');
    }
    const notification = await this.notificationsService.markAsReceived(
      id,
      userId,
      body.userDeviceId,
    );

    // Publish to GraphQL subscriptions
    try {
      await this.subscriptionService.publishNotificationUpdated(
        notification,
        userId,
      );
    } catch (error) {
      console.error(
        'Failed to publish notification updated subscription:',
        error,
      );
    }

    return notification;
  }

  @Patch(':id/device-received')
  @ApiOperation({
    summary:
      'Mark notification as received by resolving a device from its token',
  })
  @ApiBody({ type: DeviceReportReceivedDto })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as received',
    type: Notification,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing deviceToken in request body',
  })
  @ApiResponse({ status: 404, description: 'Notification or Device not found' })
  async deviceReportReceived(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() body: DeviceReportReceivedDto,
  ) {
    this.logger.log(
      `deviceReportReceived: notificationId=${id} userId=${userId} token=${body?.deviceToken ? body.deviceToken.slice(0, 8) + '…' : 'undefined'}`,
    );
    if (!body || !body.deviceToken) {
      throw new BadRequestException('Missing deviceToken in request body');
    }
    const notification =
      await this.notificationsService.markAsReceivedByDeviceToken(
        id,
        userId,
        body.deviceToken,
      );

    try {
      await this.subscriptionService.publishNotificationUpdated(
        notification,
        userId,
      );
    } catch (error) {
      console.error(
        'Failed to publish notification updated subscription:',
        error,
      );
    }

    return notification;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async remove(@Param('id') id: string, @GetUser('id') userId: string) {
    const result = await this.notificationsService.remove(id, userId);

    // Publish to GraphQL subscriptions
    try {
      await this.subscriptionService.publishNotificationDeleted(id, userId);
    } catch (error) {
      console.error(
        'Failed to publish notification deleted subscription:',
        error,
      );
    }

    return result;
  }

  @Get('notification-services')
  @ApiOperation({ summary: 'Get available notification services per platform' })
  @ApiResponse({
    status: 200,
    description: 'List of services per platform',
    type: [NotificationServicesInfoDto],
  })
  async getNotificationServices() {
    return this.notificationsService.getNotificationServices();
  }

  @UseGuards(SystemAccessTokenGuard, SystemAccessScopesGuard)
  @RequireSystemScopes(['passthrough'])
  @UseInterceptors(SystemAccessTokenStatsInterceptor)
  @Post('notify-external')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @ApiOperation({
    summary:
      'Send a push notification externally via system access token (stateless)',
  })
  @ApiBody({
    description: 'External notification request',
    type: ExternalNotifyRequestDocDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Push dispatch result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        platform: { type: 'string' },
        sentAt: { type: 'string', format: 'date-time' },
        sentWith: {
          type: 'string',
          nullable: true,
          description: 'For iOS, which delivery strategy was effectively used to talk to APNs',
          enum: Object.values(IosDeliveryStrategy),
        },
        availableMethods: {
          type: 'array',
          nullable: true,
          description: 'For iOS, which delivery strategies were made available by the caller payload',
          items: {
            type: 'string',
            enum: Object.values(IosDeliveryStrategy),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Missing notification or userDevice',
  })
  async notifyExternal(
    @Body()
    body: ExternalNotifyRequestDto,
    @GetSystemAccessToken()
    sat?: { id: string },
  ): Promise<ExternalNotifyResponseDto> {
    if (!body || !body.platform) {
      this.logger.warn('[notify-external] Missing platform in request body');
      throw new BadRequestException('Missing platform');
    }

    try {
      const result = await this.notificationsService.sendPrebuilt(body);

      if (sat && result.success) {
        await this.systemAccessTokenService.incrementCalls(sat.id);
        try {
          await this.eventsTrackingService.trackPushPassthrough(
            sat.id,
            result,
          );
        } catch { }
      } else if (sat && !result.success) {
        try {
          await this.systemAccessTokenService.incrementFailedCalls(sat.id);
        } catch { }
        try {
          await this.eventsTrackingService.trackPushPassthroughFailed(
            sat.id,
            result,
          );
        } catch { }
      }

      return result;
    } catch (error) {
      this.logger.error(
        '[notify-external] Failed to process external notification',
        error,
      );

      if (sat) {
        try {
          await this.systemAccessTokenService.incrementFailedCalls(sat.id);
        } catch { }
        try {
          await this.eventsTrackingService.trackPushPassthroughFailed(
            sat.id,
            body && body.platform ? { platform: body.platform } : undefined,
          );
        } catch { }
      }

      throw error;
    }
  }

  @Post('postpone')
  @ApiOperation({ summary: 'Postpone a notification to be resent later' })
  @ApiResponse({
    status: 201,
    description: 'Notification postponed successfully',
    type: PostponeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async postponeNotification(
    @Body() dto: PostponeNotificationDto,
    @GetUser('id') userId: string,
  ): Promise<PostponeResponseDto> {
    const postpone = await this.postponeService.createPostpone(
      dto.notificationId,
      userId,
      dto.minutes,
    );

    return {
      id: postpone.id,
      notificationId: postpone.notificationId,
      sendAt: postpone.sendAt,
      createdAt: postpone.createdAt,
    };
  }

  @Get('postpones')
  @ApiOperation({ summary: 'Get all pending postpones for the user' })
  @ApiResponse({
    status: 200,
    description: 'List of pending postpones',
  })
  async getPendingPostpones(@GetUser('id') userId: string) {
    return this.postponeService.findPendingByUser(userId);
  }

  @Delete('postpones/:id')
  @ApiOperation({ summary: 'Cancel a postponed notification' })
  @ApiResponse({
    status: 200,
    description: 'Postpone cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Postpone not found',
  })
  async cancelPostpone(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ) {
    return this.postponeService.cancelPostpone(id, userId);
  }

  // MARK: - Watch-specific endpoints (require WATCH scope)

  @Patch('watch/:id/read')
  @ApiOperation({ summary: 'Mark notification as read (Watch)' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: Notification,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @UseGuards(ScopesGuard)
  @RequireScopes([AccessTokenScope.WATCH])
  async markAsReadWatch(@Param('id') id: string, @GetUser('id') userId: string) {
    const start = Date.now();
    this.logger.log(`[WatchAPI] markAsRead start id=${id} userId=${userId}`);
    let notification: Notification;
    try {
      notification = await this.notificationsService.markAsRead(id, userId);
    } catch (error) {
      this.logger.error(
        `[WatchAPI] markAsRead error id=${id} userId=${userId} ms=${Date.now() - start}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    // Publish to GraphQL subscriptions
    try {
      await this.subscriptionService.publishNotificationUpdated(
        notification,
        userId,
      );
    } catch (error) {
      this.logger.error(
        `[WatchAPI] publishNotificationUpdated failed (read) id=${id} userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    this.logger.log(
      `[WatchAPI] markAsRead ok id=${id} userId=${userId} ms=${Date.now() - start}`,
    );

    return notification;
  }

  @Patch('watch/:id/unread')
  @ApiOperation({ summary: 'Mark notification as unread (Watch)' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as unread',
    type: Notification,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @UseGuards(ScopesGuard)
  @RequireScopes([AccessTokenScope.WATCH])
  async markAsUnreadWatch(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ) {
    const start = Date.now();
    this.logger.log(`[WatchAPI] markAsUnread start id=${id} userId=${userId}`);
    let notification: Notification;
    try {
      notification = await this.notificationsService.markAsUnread(id, userId);
    } catch (error) {
      this.logger.error(
        `[WatchAPI] markAsUnread error id=${id} userId=${userId} ms=${Date.now() - start}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    // Publish to GraphQL subscriptions
    try {
      await this.subscriptionService.publishNotificationUpdated(
        notification,
        userId,
      );
    } catch (error) {
      this.logger.error(
        `[WatchAPI] publishNotificationUpdated failed (unread) id=${id} userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    this.logger.log(
      `[WatchAPI] markAsUnread ok id=${id} userId=${userId} ms=${Date.now() - start}`,
    );

    return notification;
  }

  @Delete('watch/:id')
  @ApiOperation({ summary: 'Delete a notification (Watch)' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @UseGuards(ScopesGuard)
  @RequireScopes([AccessTokenScope.WATCH])
  async removeWatch(@Param('id') id: string, @GetUser('id') userId: string) {
    const start = Date.now();
    this.logger.log(`[WatchAPI] delete start id=${id} userId=${userId}`);
    let result: any;
    try {
      result = await this.notificationsService.remove(id, userId);
    } catch (error) {
      this.logger.error(
        `[WatchAPI] delete error id=${id} userId=${userId} ms=${Date.now() - start}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    // Publish to GraphQL subscriptions
    try {
      await this.subscriptionService.publishNotificationDeleted(id, userId);
    } catch (error) {
      this.logger.error(
        `[WatchAPI] publishNotificationDeleted failed id=${id} userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    this.logger.log(
      `[WatchAPI] delete ok id=${id} userId=${userId} ms=${Date.now() - start}`,
    );

    return result;
  }

  @Delete('watch/batch')
  @ApiOperation({ summary: 'Delete multiple notifications in batch (Watch)' })
  @ApiResponse({
    status: 200,
    description: 'Notifications deleted successfully',
    type: BatchDeleteWatchResponseDto,
  })
  @UseGuards(ScopesGuard)
  @RequireScopes([AccessTokenScope.WATCH])
  async removeBatchWatch(
    @Body() dto: BatchDeleteWatchDto,
    @GetUser('id') userId: string,
  ): Promise<BatchDeleteWatchResponseDto> {
    const start = Date.now();
    this.logger.log(
      `[WatchAPI] batch delete start count=${dto.ids.length} userId=${userId}`,
    );
    let result: { deletedIds: string[] };
    try {
      result = await this.notificationsService.removeMany(dto.ids, userId);
    } catch (error) {
      this.logger.error(
        `[WatchAPI] batch delete error count=${dto.ids.length} userId=${userId} ms=${Date.now() - start}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    // Publish to GraphQL subscriptions
    for (const id of result.deletedIds) {
      try {
        await this.subscriptionService.publishNotificationDeleted(id, userId);
      } catch (error) {
        this.logger.error(
          `[WatchAPI] publishNotificationDeleted failed id=${id} userId=${userId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `[WatchAPI] batch delete ok count=${result.deletedIds.length} userId=${userId} ms=${Date.now() - start}`,
    );

    return {
      deletedCount: result.deletedIds.length,
      deletedIds: result.deletedIds,
    };
  }

  @Patch('watch/batch/read')
  @ApiOperation({ summary: 'Mark multiple notifications as read in batch (Watch)' })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read',
    type: BatchMarkWatchResponseDto,
  })
  @UseGuards(ScopesGuard)
  @RequireScopes([AccessTokenScope.WATCH])
  async markAsReadBatchWatch(
    @Body() dto: BatchMarkReadWatchDto,
    @GetUser('id') userId: string,
  ): Promise<BatchMarkWatchResponseDto> {
    const start = Date.now();
    this.logger.log(
      `[WatchAPI] batch markAsRead start count=${dto.ids.length} userId=${userId}`,
    );
    let result: { notifications: Notification[]; updatedCount: number };
    try {
      result = await this.notificationsService.markNotificationsAsReadBatch(
        dto.ids,
        userId,
      );
    } catch (error) {
      this.logger.error(
        `[WatchAPI] batch markAsRead error count=${dto.ids.length} userId=${userId} ms=${Date.now() - start}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    // Publish to GraphQL subscriptions
    for (const notification of result.notifications) {
      try {
        await this.subscriptionService.publishNotificationUpdated(
          notification,
          userId,
        );
      } catch (error) {
        this.logger.error(
          `[WatchAPI] publishNotificationUpdated failed (read) id=${notification.id} userId=${userId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `[WatchAPI] batch markAsRead ok count=${result.updatedCount} userId=${userId} ms=${Date.now() - start}`,
    );

    return {
      updatedCount: result.updatedCount,
      success: true,
    };
  }

  @Patch('watch/batch/unread')
  @ApiOperation({ summary: 'Mark multiple notifications as unread in batch (Watch)' })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as unread',
    type: BatchMarkWatchResponseDto,
  })
  @UseGuards(ScopesGuard)
  @RequireScopes([AccessTokenScope.WATCH])
  async markAsUnreadBatchWatch(
    @Body() dto: BatchMarkUnreadWatchDto,
    @GetUser('id') userId: string,
  ): Promise<BatchMarkWatchResponseDto> {
    const start = Date.now();
    this.logger.log(
      `[WatchAPI] batch markAsUnread start count=${dto.ids.length} userId=${userId}`,
    );
    let result: { notifications: Notification[]; updatedCount: number };
    try {
      result = await this.notificationsService.markNotificationsAsUnreadBatch(
        dto.ids,
        userId,
      );
    } catch (error) {
      this.logger.error(
        `[WatchAPI] batch markAsUnread error count=${dto.ids.length} userId=${userId} ms=${Date.now() - start}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    // Publish to GraphQL subscriptions
    for (const notification of result.notifications) {
      try {
        await this.subscriptionService.publishNotificationUpdated(
          notification,
          userId,
        );
      } catch (error) {
        this.logger.error(
          `[WatchAPI] publishNotificationUpdated failed (unread) id=${notification.id} userId=${userId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `[WatchAPI] batch markAsUnread ok count=${result.updatedCount} userId=${userId} ms=${Date.now() - start}`,
    );

    return {
      updatedCount: result.updatedCount,
      success: true,
    };
  }

  @Post('watch/postpone')
  @ApiOperation({ summary: 'Postpone a notification to be resent later (Watch)' })
  @ApiResponse({
    status: 201,
    description: 'Notification postponed successfully',
    type: PostponeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  @UseGuards(ScopesGuard)
  @RequireScopes([AccessTokenScope.WATCH])
  async postponeNotificationWatch(
    @Body() dto: PostponeNotificationDto,
    @GetUser('id') userId: string,
  ): Promise<PostponeResponseDto> {
    const start = Date.now();
    this.logger.log(
      `[WatchAPI] postpone start notificationId=${dto.notificationId} minutes=${dto.minutes} userId=${userId}`,
    );
    let postpone: any;
    try {
      postpone = await this.postponeService.createPostpone(
        dto.notificationId,
        userId,
        dto.minutes,
      );
    } catch (error) {
      this.logger.error(
        `[WatchAPI] postpone error notificationId=${dto.notificationId} minutes=${dto.minutes} userId=${userId} ms=${Date.now() - start}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    this.logger.log(
      `[WatchAPI] postpone ok notificationId=${dto.notificationId} minutes=${dto.minutes} userId=${userId} ms=${Date.now() - start}`,
    );

    return {
      id: postpone.id,
      notificationId: postpone.notificationId,
      sendAt: postpone.sendAt,
      createdAt: postpone.createdAt,
    };
  }
}
