import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UrlBuilderService } from '../common/services/url-builder.service';
import { Notification } from '../entities/notification.entity';
import { DevicePlatform } from '../users/dto';
import { UsersService } from '../users/users.service';
import { NotificationServiceInfo } from './dto';
import { ExternalDeviceDataFcmDto, ExternalDeviceDataIosDto, ExternalDeviceDataWebDto, ExternalNotifyRequestDto, ExternalPlatform } from './dto/external-notify.dto';
import { FirebasePushService } from './firebase-push.service';
import { IOSPushService } from './ios-push.service';
import { NotificationServiceType } from './notifications.types';
import { WebPushService } from './web-push.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly urlBuilderService: UrlBuilderService,
    private readonly usersService: UsersService,
    private readonly iosPushService: IOSPushService,
    private readonly firebasePushService: FirebasePushService,
    private readonly webPushService: WebPushService,
    private readonly configService: ConfigService,
  ) {}

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
    notification.readAt = new Date();

    const updated = await this.notificationsRepository.save(notification);
    this.logger.log(`Notification ${id} marked as read for user ${userId}`);

    return this.findOne(id, userId);
  }

  async markAsUnread(id: string, userId: string): Promise<Notification> {
    const notification = await this.findOne(id, userId);
    notification.readAt = undefined;

    const updated = await this.notificationsRepository.save(notification);
    this.logger.log(`Notification ${id} marked as unread for user ${userId}`);

    return this.findOne(id, userId);
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.notificationsRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    const updatedCount = result.affected || 0;
    this.logger.log(
      `Marked ${updatedCount} notifications as read for user ${userId}`,
    );

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
    const target = await this.findOne(id, userId);
    const device = await this.usersService.findDeviceByUserToken(
      userId,
      deviceToken,
    );
    if (!device) {
      this.logger.warn(
        `updateReceivedUpTo: device not found for user=${userId} token=${deviceToken?.slice(0, 8) ?? 'undefined'}...`,
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
    if (updatedCount) {
      this.logger.debug(
        `Updated receivedAt for ${updatedCount} notifications on device=${deviceId} (up to ${target.id}) for user ${userId}`,
      );
    }

    return { updatedCount };
  }

  async remove(id: string, userId: string): Promise<void> {
    const notification = await this.findOne(id, userId);
    await this.notificationsRepository.remove(notification);
  }

  /**
   * Remove many notifications by ids for a specific user.
   * Silently skips ids that don't exist or don't belong to the user.
   */
  async removeMany(ids: string[], userId: string): Promise<{ deletedIds: string[] }> {
    if (!ids?.length) return { deletedIds: [] };

    // Find only existing notifications for this user
    const existing = await this.notificationsRepository.find({
      where: ids.map((id) => ({ id, userId } as any)),
      select: { id: true } as any,
    });
    const existingIds = existing.map(n => n.id);
    if (existingIds.length === 0) return { deletedIds: [] };

    // Delete by ids using query for efficiency
    await this.notificationsRepository
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('"userId" = :userId', { userId })
      .andWhere('id IN (:...ids)', { ids: existingIds })
      .execute();

    this.logger.log(`Removed ${existingIds.length} notifications for user ${userId}`);
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

    // Check if push notification services are properly initialized
    const pushServicesInitialized =
      await this.checkPushServicesInitialization();

    // iOS Platform
    const apnEnabled = this.configService.get<string>(
      'APN_PUSH_ENABLED',
      'true',
    );
    if (apnEnabled === 'true' && pushServicesInitialized) {
      services.push({
        devicePlatform: DevicePlatform.IOS,
        service: NotificationServiceType.PUSH,
      });
    } else {
      services.push({
        devicePlatform: DevicePlatform.IOS,
        service: NotificationServiceType.LOCAL,
      });
    }

    // Android Platform
    const firebaseEnabled = this.configService.get<string>(
      'FIREBASE_PUSH_ENABLED',
      'true',
    );
    if (firebaseEnabled === 'true' && pushServicesInitialized) {
      services.push({
        devicePlatform: DevicePlatform.ANDROID,
        service: NotificationServiceType.PUSH,
      });
    } else {
      services.push({
        devicePlatform: DevicePlatform.ANDROID,
        service: NotificationServiceType.LOCAL,
      });
    }

    // Web Platform
    const webPushEnabled = this.configService.get<string>(
      'WEB_PUSH_ENABLED',
      'true',
    );
    if (webPushEnabled === 'true' && pushServicesInitialized) {
      services.push({
        devicePlatform: DevicePlatform.WEB,
        service: NotificationServiceType.PUSH,
      });
    } else {
      services.push({
        devicePlatform: DevicePlatform.WEB,
        service: NotificationServiceType.LOCAL,
      });
    }

    return services;
  }

  /**
   * Check if push notification services are properly initialized
   */
  private async checkPushServicesInitialization(): Promise<boolean> {
    try {
      // Check if services are enabled via environment variables
      const firebaseEnabled = this.configService.get<boolean>(
        'FIREBASE_PUSH_ENABLED',
        true,
      );
      const apnEnabled = this.configService.get<boolean>(
        'APN_PUSH_ENABLED',
        true,
      );
      const webPushEnabled = this.configService.get<boolean>(
        'WEB_PUSH_ENABLED',
        true,
      );

      // Check iOS push service initialization (only if APN is enabled)
      if (
        apnEnabled &&
        this.iosPushService &&
        (this.iosPushService as any).provider
      ) {
        // iOS service is initialized if provider exists
        return true;
      }

      // Check Firebase push service initialization (only if Firebase is enabled)
      if (
        firebaseEnabled &&
        this.firebasePushService &&
        (this.firebasePushService as any).app
      ) {
        // Firebase service is initialized if app exists
        return true;
      }

      // Check Web push service initialization (only if Web Push is enabled)
      if (
        webPushEnabled &&
        this.webPushService &&
        (this.webPushService as any).configured
      ) {
        // Web push service is initialized if configured is true
        return true;
      }

      // If none of the enabled push services are properly initialized, return false
      return false;
    } catch (error) {
      this.logger.warn('Error checking push services initialization:', error);
      return false;
    }
  }

  /**
   * Send prebuilt payloads (as-is) from passthrough entrypoint.
   */
  async sendPrebuilt(body: ExternalNotifyRequestDto): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Processing sendPrebuilt for platform: ${body.platform}`);
    
    if (body.platform === ExternalPlatform.IOS) {
      this.logger.log(`Sending iOS prebuilt notification to token: ${(body.deviceData as ExternalDeviceDataIosDto).token}`);
      const res = await this.iosPushService.sendPrebuilt(
        body.deviceData as ExternalDeviceDataIosDto,
        body.payload,
      );
      this.logger.log(`iOS sendPrebuilt result: ${JSON.stringify(res)}`);
      return { success: res.success };
    }

    if (body.platform === ExternalPlatform.ANDROID) {
      const res = await this.firebasePushService.sendPrebuilt(
        body.deviceData as ExternalDeviceDataFcmDto,
        body.payload as any,
      );
      return { success: res.success };
    }

    if (body.platform === ExternalPlatform.WEB) {
      const res = await this.webPushService.sendPrebuilt(
        body.deviceData as ExternalDeviceDataWebDto,
        body.payload as any,
      );
      return { success: res.success };
    }

    return { success: false, message: 'Unsupported platform' };
  }
}
