import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Notification } from '../entities/notification.entity';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { GetSystemAccessToken } from '../system-access-token/decorators/get-system-access-token.decorator';
import { SystemAccessTokenGuard } from '../system-access-token/system-access-token.guard';
import { SystemAccessTokenService } from '../system-access-token/system-access-token.service';
import { UsersService } from '../users/users.service';
import { ExternalNotifyRequestDto } from './dto/external-notify.dto';
import { ApiBody } from '@nestjs/swagger';
import {
  MarkReceivedDto,
  DeviceReportReceivedDto,
  UpdateReceivedUpToDto,
  ExternalNotifyRequestDocDto,
  NotificationServicesInfoDto,
} from './dto';
import { IOSPushService } from './ios-push.service';
import { NotificationsService } from './notifications.service';
import { PushNotificationOrchestratorService } from './push-orchestrator.service';

@UseGuards(JwtOrAccessTokenGuard)
@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth()
export class NotificationsController {
  private readonly logger = new Logger('NotificationsController');

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly subscriptionService: GraphQLSubscriptionService,
    private readonly pushOrchestrator: PushNotificationOrchestratorService,
    private readonly systemAccessTokenService: SystemAccessTokenService,
    private readonly iosPushService: IOSPushService,
    private readonly usersService: UsersService,
  ) {}

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
  @ApiResponse({ status: 200, description: 'Notification details', type: Notification })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  findOne(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.notificationsService.findOne(id, userId);
  }

  @Patch(':id/sent')
  @ApiOperation({ summary: 'Mark notification as sent (internal client acknowledgement)' })
  @ApiResponse({ status: 200, description: 'Notification marked as sent', type: Notification })
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
  @ApiOperation({ summary: 'Mark all notifications up to (and including) the given one as received for the resolved device' })
  @ApiBody({ type: UpdateReceivedUpToDto })
  @ApiResponse({ status: 200, description: 'Notifications updated count', schema: { type: 'object', properties: { updatedCount: { type: 'number' } } } })
  @ApiResponse({ status: 400, description: 'Missing id or deviceToken in request body' })
  async updateReceived(
    @Body() body: UpdateReceivedUpToDto,
    @GetUser('id') userId: string,
  ) {
    if (!body || !body.id || !body.deviceToken) {
      throw new BadRequestException('Missing id or deviceToken in request body');
    }
    return this.notificationsService.updateReceivedUpTo(body.id, userId, body.deviceToken);
  }

  @Patch(':id/received')
  @ApiOperation({ summary: 'Mark notification as received by a specific user device (ID)' })
  @ApiBody({ type: MarkReceivedDto })
  @ApiResponse({ status: 200, description: 'Notification marked as received', type: Notification })
  @ApiResponse({ status: 400, description: 'Missing userDeviceId in request body' })
  @ApiResponse({ status: 403, description: 'Device not owned by user' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsReceived(@Param('id') id: string, @GetUser('id') userId: string, @Body() body: MarkReceivedDto) {
    if (!body || !body.userDeviceId) {
      throw new BadRequestException('Missing userDeviceId in request body');
    }
    const notification = await this.notificationsService.markAsReceived(id, userId, body.userDeviceId);

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
  @ApiOperation({ summary: 'Mark notification as received by resolving a device from its token' })
  @ApiBody({ type: DeviceReportReceivedDto })
  @ApiResponse({ status: 200, description: 'Notification marked as received', type: Notification })
  @ApiResponse({ status: 400, description: 'Missing deviceToken in request body' })
  @ApiResponse({ status: 404, description: 'Notification or Device not found' })
  async deviceReportReceived(@Param('id') id: string, @GetUser('id') userId: string, @Body() body: DeviceReportReceivedDto) {
    this.logger.log(`deviceReportReceived: notificationId=${id} userId=${userId} token=${body?.deviceToken ? body.deviceToken.slice(0, 8) + '…' : 'undefined'}`);
    if (!body || !body.deviceToken) {
      throw new BadRequestException('Missing deviceToken in request body');
    }
    const notification = await this.notificationsService.markAsReceivedByDeviceToken(id, userId, body.deviceToken);

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
  @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
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
  @ApiResponse({ status: 200, description: 'List of services per platform', type: [NotificationServicesInfoDto] })
  async getNotificationServices() { return this.notificationsService.getNotificationServices(); }

  @UseGuards(SystemAccessTokenGuard)
  @SetMetadata('allowSystemToken', true)
  @Post('notify-external')
  @ApiOperation({ summary: 'Send a push notification externally via system access token (stateless)' })
  @ApiBody({ description: 'External notification request', type: ExternalNotifyRequestDocDto })
  @ApiResponse({ status: 200, description: 'Push dispatch result', schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, platform: { type: 'string' }, sentAt: { type: 'string', format: 'date-time' } } } })
  @ApiResponse({ status: 400, description: 'Missing notification or userDevice' })
  async notifyExternal(@Body() body: ExternalNotifyRequestDto, @GetSystemAccessToken() sat?: { id: string }) {
    if (!body || !body.notification || !body.userDevice) {
      throw new BadRequestException('Missing notification or userDevice');
    }

    if (sat) {
      this.logger.log(
        `Processing external notification request using system access token: ${sat.id}`,
      );
    }

    const notificationParsed = JSON.parse(body.notification);
    const userDeviceParsed = JSON.parse(body.userDevice);
    const result = await this.pushOrchestrator.sendPushToSingleDeviceStateless(
      notificationParsed,
      userDeviceParsed,
    );

    if (sat && result.success) {
      this.logger.log(
        `Incrementing call count for system access token: ${sat.id}`,
      );
      await this.systemAccessTokenService.incrementCalls(sat.id);
    } else if (sat && !result.success) {
      this.logger.warn(
        `External notification failed for system access token: ${sat.id}, not incrementing call count`,
      );
    }

    return result;
  }
}
