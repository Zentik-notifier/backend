import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BucketsService } from '../buckets/buckets.service';
import { UrlBuilderService } from '../common/services/url-builder.service';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { ServerSettingType } from '../entities/server-setting.entity';
import { UserDevice } from '../entities/user-device.entity';
import { UserSettingType } from '../entities/user-setting.entity';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { DevicePlatform } from '../users/dto';
import { UsersService } from '../users/users.service';
import { FirebasePushService } from './firebase-push.service';
import { IOSPushService } from './ios-push.service';
import { WebPushService } from './web-push.service';

export interface PushResult {
  success: boolean;
  successCount?: number;
  errorCount?: number;
  errors?: string[];
  error?: string;
}

@Injectable()
export class PushNotificationOrchestratorService {
  private readonly logger = new Logger(
    PushNotificationOrchestratorService.name,
  );

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(UserDevice)
    private readonly userDevicesRepository: Repository<UserDevice>,
    private readonly iosPushService: IOSPushService,
    private readonly firebasePushService: FirebasePushService,
    private readonly entityPermissionService: EntityPermissionService,
    private readonly subscriptionService: GraphQLSubscriptionService,
    private readonly webPushService: WebPushService,
    private readonly urlBuilderService: UrlBuilderService,
    private readonly bucketsService: BucketsService,
    private readonly configService: ConfigService,
    private readonly eventTrackingService: EventTrackingService,
    private readonly usersService: UsersService,
    private readonly serverSettingsService: ServerSettingsService,
  ) {}

  /**
   * Check if a bucket is snoozed for a specific user using pre-loaded data
   * @param bucketId - The bucket ID to check
   * @param userId - The user ID to check snooze status for
   * @param userBucket - The pre-loaded user-bucket data (can be undefined if no relationship exists)
   * @returns true if the bucket is currently snoozed, false otherwise
   */
  private isBucketSnoozedForUserFromData(
    bucketId: string,
    userId: string,
    userBucket?: any,
  ): boolean {
    try {
      // If no user-bucket relationship exists, user should receive notifications (no snooze configured)
      if (!userBucket) {
        return false;
      }

      // Check if bucket is snoozed until a specific time
      if (userBucket.snoozeUntil) {
        const now = new Date();
        const snoozeUntil = new Date(userBucket.snoozeUntil);

        if (now < snoozeUntil) {
          this.logger.debug(
            `Bucket ${bucketId} is snoozed until ${snoozeUntil} for user ${userId}`,
          );
          return true;
        }
      }

      // Check recurring snooze schedules
      if (userBucket.snoozes && userBucket.snoozes.length > 0) {
        const now = new Date();
        const currentDay = now
          .toLocaleDateString('en-US', { weekday: 'long' })
          .toLowerCase();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

        for (const schedule of userBucket.snoozes) {
          if (!schedule.isEnabled) continue;

          if (schedule.days.includes(currentDay)) {
            if (
              currentTime >= schedule.timeFrom &&
              currentTime <= schedule.timeTill
            ) {
              this.logger.debug(
                `Bucket ${bucketId} is snoozed due to recurring schedule for user ${userId} (${currentDay} ${schedule.timeFrom}-${schedule.timeTill})`,
              );
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Error checking snooze status for bucket ${bucketId} and user ${userId}:`,
        error,
      );
      // If there's an error checking snooze status, allow the notification to be sent
      return false;
    }
  }

  /**
   * Create notifications for all authorized users and send push notifications
   */
  async create(
    message: Message,
    requesterId: string,
    userIds?: string[],
  ): Promise<Notification[]> {
    // Get authorized users for the bucket
    let authorizedUsers =
      await this.entityPermissionService.getBucketAuthorizedUserIds(
        message.bucketId,
      );

    // Filter by specific userIds if provided
    if (userIds && userIds.length > 0) {
      authorizedUsers = authorizedUsers.filter((userId) =>
        userIds.includes(userId),
      );
      this.logger.log(
        `Filtered to ${authorizedUsers.length} users from provided userIds: ${userIds.join(', ')}`,
      );
    }

    if (authorizedUsers.length === 0) {
      this.logger.warn(
        `No authorized users found for bucket ${message.bucketId}${userIds ? ` with userIds filter: ${userIds.join(', ')}` : ''}`,
      );
      return [];
    }

    // Get target devices for all authorized users (including onlyLocal devices)
    const targetDevices = await this.userDevicesRepository.find({
      where: {
        userId: In(authorizedUsers),
      },
      relations: ['user'],
      order: { lastUsed: 'DESC' },
    });

    const platforms =
      Array.from(new Set(targetDevices.map((d) => d.platform))).join(', ') ||
      'none';
    const localOnlyCount = targetDevices.filter((d) => d.onlyLocal).length;
    this.logger.log(
      `Found ${targetDevices.length} target devices for ${authorizedUsers.length} users (platforms: ${platforms}, onlyLocal: ${localOnlyCount}, bucket: ${message.bucketId})`,
    );

    // Track notification events for each device
    for (const device of targetDevices) {
      await this.eventTrackingService.trackNotification(
        device.userId,
        device.id,
      );
    }

    // Create one notification per device (user + device pair) - ALWAYS create notifications
    const notificationsPerDevice: Notification[] = [];
    for (const device of targetDevices) {
      const notification = this.notificationsRepository.create({
        userId: device.userId,
        userDeviceId: device.id,
        message: message,
      } as any);

      const savedResult = await this.notificationsRepository.save(notification);
      const saved: Notification = Array.isArray(savedResult)
        ? savedResult[0]
        : (savedResult as Notification);
      notificationsPerDevice.push(saved);
    }

    // Get all user-bucket relationships for this bucket and users to check snooze status efficiently
    const userBuckets =
      await this.bucketsService.findUserBucketsByBucketAndUsers(
        message.bucketId,
        authorizedUsers,
      );
    const userBucketMap = new Map(userBuckets.map((ub) => [ub.userId, ub]));

    // Load relations and publish GraphQL subscriptions
    const notificationsWithRelations: Notification[] = [];
    for (const notification of notificationsPerDevice) {
      const notificationWithRelations =
        await this.notificationsRepository.findOne({
          where: { id: notification.id },
          relations: ['user', 'message', 'message.bucket', 'userDevice'],
        });
      if (notificationWithRelations) {
        notificationsWithRelations.push(notificationWithRelations);
        try {
          await this.subscriptionService.publishNotificationCreated(
            notificationWithRelations,
            notificationWithRelations.userId,
          );
        } catch (error) {
          this.logger.error(
            `Failed to publish notification subscription for user ${notificationWithRelations.userId}`,
            error,
          );
        }
      }
    }

    // Process notifications to add attachment URLs before sending push
    const processedNotifications = this.urlBuilderService.processNotifications(
      notificationsWithRelations,
    );

    // Send push per device so that each payload contains the specific notificationId
    const deviceIdToDevice: Record<string, UserDevice> = Object.fromEntries(
      targetDevices.map((d) => [d.id, d]),
    );
    let snoozedCount = 0;

    for (const notif of processedNotifications) {
      const device = notif.userDeviceId
        ? deviceIdToDevice[notif.userDeviceId]
        : undefined;
      if (!device) {
        this.logger.warn(
          `No device found for notification ${notif.id} (user ${notif.userId})`,
        );
        continue;
      }

      // If device is local-only, we create the notification and publish subscription
      // but do not attempt to send a push to external push services.
      if (device.onlyLocal) {
        this.logger.debug(
          `Device ${device.id} is onlyLocal - skipping external push for notification ${notif.id}`,
        );
        continue;
      }

      // Check if bucket is snoozed for this user before sending push
      const isSnoozed = this.isBucketSnoozedForUserFromData(
        message.bucketId,
        device.userId,
        userBucketMap.get(device.userId),
      );

      if (isSnoozed) {
        this.logger.debug(
          `Skipping push for notification ${notif.id} - bucket ${message.bucketId} is snoozed for user ${device.userId}`,
        );
        snoozedCount++;
        continue;
      }

      // Use DB-updating variant inside orchestrated flow
      const result = await this.dispatchPush(notif, device);
      try {
        if (result.success) {
          await this.notificationsRepository.update(notif.id, {
            sentAt: new Date(),
          });
        } else if (result.error) {
          await this.notificationsRepository.update(notif.id, {
            error: result.error,
          });
          // Conditional retry for APNs PayloadTooLarge if user setting allows
          if (
            typeof result.error === 'string' &&
            result.error.includes('PayloadTooLarge')
          ) {
            try {
              const setting = await this.usersService.getUserSetting(
                notif.userId,
                UserSettingType.UnencryptOnBigPayload,
                device.id,
              );
              const allowRetry = setting?.valueBool === true;
              if (allowRetry) {
                this.logger.warn(
                  `Retrying push without encryption for notification ${notif.id} (user setting enabled)`,
                );
                const retry = await this.sendPushToSingleDeviceStateless(
                  notif,
                  { ...device, onlyLocal: device.onlyLocal } as any,
                );
                if (retry.success) {
                  await this.notificationsRepository.update(notif.id, {
                    sentAt: new Date(),
                    error: null as any,
                  });
                }
              }
            } catch (e) {
              this.logger.warn('Retry check failed, skipping retry');
            }
          }
        }
      } catch {}
    }

    // Log how many push notifications were skipped due to snoozes
    if (snoozedCount > 0) {
      this.logger.log(
        `Skipped ${snoozedCount} push notifications due to bucket snoozes (notifications were still created in database)`,
      );
    }

    return processedNotifications;
  }

  /**
   * Extracted push sending logic for a single notification-device pair.
   */
  public async sendPushToSingleDeviceStateless(
    notification: Notification,
    userDevice: UserDevice,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (userDevice.platform === DevicePlatform.IOS) {
        const result = await this.iosPushService.send(notification, [
          userDevice,
        ]);
        return { success: !!result.success, error: result.error };
      } else if (userDevice.platform === DevicePlatform.ANDROID) {
        const result = await this.firebasePushService.send(notification, [
          userDevice,
        ]);
        const ok = result.success && (result.successCount || 0) > 0;
        const firstError = result.results?.find((r) => !r.success)?.error;
        return { success: ok, error: ok ? undefined : firstError };
      } else if (userDevice.platform === DevicePlatform.WEB) {
        const result = await this.webPushService.send(notification, [
          userDevice,
        ]);
        const ok = !!result.success;
        const firstError = result.results?.find((r) => !r.success)?.error;
        return { success: ok, error: ok ? undefined : firstError };
      } else {
        this.logger.warn(
          `Unsupported platform for device ${userDevice.id}: ${userDevice.platform}`,
        );
        return { success: false, error: 'Unsupported platform' };
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send push (stateless) for notification ${notification.id} (device ${userDevice.id})`,
        error,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Get push mode (Off/Local/Onboard/Passthrough) for a specific platform
   */
  private async getPushMode(
    platform: DevicePlatform,
  ): Promise<'Off' | 'Local' | 'Onboard' | 'Passthrough'> {
    let settingType: ServerSettingType;

    switch (platform) {
      case DevicePlatform.IOS:
        settingType = ServerSettingType.ApnPush;
        break;
      case DevicePlatform.ANDROID:
        settingType = ServerSettingType.FirebasePush;
        break;
      case DevicePlatform.WEB:
        settingType = ServerSettingType.WebPush;
        break;
      default:
        return 'Off';
    }

    const mode = await this.serverSettingsService.getStringValue(
      settingType,
      'Off',
    );
    
    // Validate the mode value
    if (mode === 'Off' || mode === 'Local' || mode === 'Onboard' || mode === 'Passthrough') {
      return mode;
    }
    
    this.logger.warn(
      `Invalid push mode '${mode}' for ${platform}, defaulting to 'Off'`,
    );
    return 'Off';
  }

  /**
   * Decide whether to send via onboard services, passthrough, or not at all, based on server settings.
   */
  private async dispatchPush(
    notification: Notification,
    userDevice: UserDevice,
  ): Promise<{ success: boolean; error?: string }> {
    // Get the push mode for this platform
    const mode = await this.getPushMode(userDevice.platform);

    // Off - don't send anything (no push, no local)
    if (mode === 'Off') {
      this.logger.debug(
        `Push dispatch: ${userDevice.platform} is set to 'Off', skipping all notifications`,
      );
      return { success: false, error: 'Notifications completely disabled for this platform' };
    }

    // Local - device-only notifications (no server push)
    if (mode === 'Local') {
      this.logger.debug(
        `Push dispatch: ${userDevice.platform} is set to 'Local', using device-only notifications`,
      );
      return { success: false, error: 'Local mode: notifications handled by device only' };
    }

    // Onboard - use local onboard push services (APN, Firebase, WebPush)
    if (mode === 'Onboard') {
      this.logger.log(
        `Push dispatch: using ONBOARD push services for ${userDevice.platform}`,
      );
      return this.sendPushToSingleDeviceStateless(notification, userDevice);
    }

    // Passthrough - use passthrough server
    if (mode === 'Passthrough') {
      const server = await this.serverSettingsService.getStringValue(
        ServerSettingType.PushNotificationsPassthroughServer,
      );
      const token = await this.serverSettingsService.getStringValue(
        ServerSettingType.PushPassthroughToken,
      );

      if (!server || !token) {
        const error = 'Passthrough mode enabled but server or token not configured';
        this.logger.error(error);
        return { success: false, error };
      }

      this.logger.log(
        `Push dispatch: using PASSTHROUGH server ${server} for ${userDevice.platform}`,
      );
      return this.sendViaPassthrough(server, token, notification, userDevice);
    }

    // Should never reach here due to validation in getPushMode
    return { success: false, error: 'Invalid push mode' };
  }

  /**
   * Send push by delegating to an external server notify endpoint.
   */
  private async sendViaPassthrough(
    server: string,
    token: string,
    notification: Notification,
    userDevice: UserDevice,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${server.replace(/\/$/, '')}/notifications/notify-external`;
      const payload = await this.buildExternalPayload(notification, userDevice);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true };
      }
      const error =
        (data && (data.error || data.message)) || `HTTP ${res.status}`;
      return { success: false, error };
    } catch (error: any) {
      this.logger.error('Passthrough push failed', error);
      return { success: false, error: error?.message || 'Passthrough error' };
    }
  }

  private async buildExternalPayload(
    notification: Notification,
    device: UserDevice,
  ) {
    if (device.platform === DevicePlatform.IOS) {
      const { payload: rawPayload, customPayload } =
        await this.iosPushService.buildAPNsPayload(notification, [], device);
      const priority = notification.message.deliveryType === 'SILENT' ? 5 : 10;

      return {
        platform: 'IOS',
        payload: {
          rawPayload,
          customPayload,
          priority,
          topic: process.env.APN_BUNDLE_ID || 'com.apocaliss92.zentik',
        },
        deviceData: {
          token: device.deviceToken,
        },
      };
    }

    if (device.platform === DevicePlatform.ANDROID) {
      const msg = await this.firebasePushService.buildFirebaseMessage(
        notification,
        [device.deviceToken || ''],
      );
      return {
        platform: 'ANDROID',
        payload: msg,
        deviceData: {
          token: device.deviceToken,
        },
      };
    }

    // WEB
    const webPayload = this.webPushService.buildWebPayload(notification);
    return {
      platform: 'WEB',
      payload: webPayload,
      deviceData: {
        endpoint: device.subscriptionFields?.endpoint,
        p256dh: device.subscriptionFields?.p256dh,
        auth: device.subscriptionFields?.auth,
        publicKey: device.publicKey,
        privateKey: device.privateKey,
      },
    };
  }
}
