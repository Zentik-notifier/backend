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
  findOne(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.notificationsService.findOne(id, userId);
  }

  @Patch(':id/sent')
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
    summary: 'Mark all notifications older than the given one as received',
  })
  async updateReceived(
    @Body() body: { id: string; deviceToken: string },
    @GetUser('id') userId: string,
  ) {
    if (!body || !body.id || !body.deviceToken) {
      throw new BadRequestException(
        `Missing id or deviceToken in request body`,
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
    summary: 'Mark notification as received by a specific device',
  })
  async markAsReceived(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() body: { userDeviceId: string },
  ) {
    if (!body || !body.userDeviceId) {
      throw new BadRequestException(`Missing userDeviceId in request body`);
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
    summary: 'Device reports a notification as received using device token',
  })
  async deviceReportReceived(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() body: { deviceToken: string },
  ) {
    this.logger.log(
      `deviceReportReceived: notificationId=${id} userId=${userId} token=${body?.deviceToken ? body.deviceToken.slice(0, 8) + '…' : 'undefined'}`,
    );
    if (!body || !body.deviceToken) {
      throw new BadRequestException(`Missing deviceToken in request body`);
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
  @ApiOperation({
    summary: 'Get all available notification services for all platforms',
    description:
      'Returns which notification services are available and enabled for each platform',
  })
  @ApiResponse({
    status: 200,
    description: 'Available notification services for all platforms',
    type: [Object],
  })
  async getNotificationServices() {
    return this.notificationsService.getNotificationServices();
  }

  @UseGuards(SystemAccessTokenGuard)
  @SetMetadata('allowSystemToken', true)
  @Post('notify-external')
  @ApiOperation({
    summary:
      'Send a push notification externally via system access token (stateless)',
  })
  @ApiResponse({ status: 200, description: 'Push triggered' })
  async notifyExternal(
    @Body() body: ExternalNotifyRequestDto,
    @GetSystemAccessToken() sat?: { id: string },
  ) {
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
