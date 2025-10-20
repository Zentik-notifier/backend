import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BucketsService } from '../buckets/buckets.service';
import { LocaleService } from '../common/services/locale.service';
import { UrlBuilderService } from '../common/services/url-builder.service';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { ServerSettingType } from '../entities/server-setting.entity';
import { UserDevice } from '../entities/user-device.entity';
import { UserSettingType } from '../entities/user-setting.types';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { DevicePlatform } from '../users/dto';
import { UsersService } from '../users/users.service';
import { FirebasePushService } from './firebase-push.service';
import { IOSPushService } from './ios-push.service';
import { AutoActionSettings } from './notification-actions.util';
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
    private readonly eventTrackingService: EventTrackingService,
    private readonly usersService: UsersService,
    private readonly serverSettingsService: ServerSettingsService,
    private readonly localeService: LocaleService,
  ) { }

  /**
 * Get device-specific settings for multiple devices in one batch
 * Returns a map with key format: "deviceId" -> settings
 * Makes ONE query per device since settings are now device+user level
 */
  private parseListSetting(raw?: string | null): number[] | undefined {
    if (!raw) return undefined;
    try {
      // Accept comma-separated or JSON array
      const arr = raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split(',');
      return (arr as any[]).map((v) => Number(v)).filter((n) => !isNaN(n));
    } catch {
      return undefined;
    }
  }

  private buildAutoActionSettings(settings: Map<UserSettingType, any>): AutoActionSettings {
    const defaultSnoozesRaw = settings.get(UserSettingType.DefaultSnoozes)?.valueText;
    const defaultPostponesRaw = settings.get(UserSettingType.DefaultPostpones)?.valueText;

    const defaultSnoozes = this.parseListSetting(defaultSnoozesRaw);
    const defaultPostpones = this.parseListSetting(defaultPostponesRaw);



    return {
      autoAddDeleteAction: settings.get(UserSettingType.AutoAddDeleteAction)?.valueBool ?? true,
      autoAddMarkAsReadAction: settings.get(UserSettingType.AutoAddMarkAsReadAction)?.valueBool ?? true,
      autoAddOpenNotificationAction: settings.get(UserSettingType.AutoAddOpenNotificationAction)?.valueBool ?? false,
      defaultSnoozes,
      defaultPostpones,
    };
  }

  private async getDeviceSettingsForMultipleDevices(
    devices: Array<{ deviceId: string; userId: string }>,
  ): Promise<Map<string, AutoActionSettings>> {

    const settingsMap = new Map<string, AutoActionSettings>();

    // Get all settings for all devices in parallel
    const configTypes = [
      UserSettingType.AutoAddDeleteAction,
      UserSettingType.AutoAddMarkAsReadAction,
      UserSettingType.AutoAddOpenNotificationAction,
      UserSettingType.DefaultSnoozes,
      UserSettingType.DefaultPostpones,
    ];

    // Fetch settings once per device in parallel
    const settingsPromises = devices.map(async ({ deviceId, userId }) => {
      const settings = await this.usersService.getMultipleUserSettings(
        userId,
        configTypes,
        deviceId, // Pass deviceId for device-specific settings
      );

      const deviceSettings: AutoActionSettings = this.buildAutoActionSettings(settings);

      return { deviceId, deviceSettings };
    });

    const results = await Promise.all(settingsPromises);

    // Build map: deviceId -> settings
    results.forEach(({ deviceId, deviceSettings }) => {
      settingsMap.set(deviceId, deviceSettings);
    });

    return settingsMap;
  }

  /**
   * Send push notifications to devices for given notifications
   * Handles passthrough, snooze checks, onlyLocal devices, and error handling
   * Reusable method for both create() and resendNotification()
   * Completely autonomous - loads devices, settings, buckets internally
   */
  private async sendPushToDevices(
    notifications: Notification[],
    userIds: string[],
    bucketId?: string,
    skipNotificationTracking = false,
  ): Promise<{
    processedNotifications: Notification[];
    successCount: number;
    errorCount: number;
    snoozedCount: number;
    errors: string[];
    iosSent: number;
    androidSent: number;
    webSent: number;
  }> {


    // Get target devices for all users (including onlyLocal devices)
    const targetDevices = await this.userDevicesRepository.find({
      where: {
        userId: In(userIds),
      },
      relations: ['user'],
      order: { lastUsed: 'DESC' },
    });


    // Get device-specific settings in batch (1 query per device)
    const deviceInfoArray = targetDevices.map(d => ({ deviceId: d.id, userId: d.userId }));
    const deviceSettingsMap = await this.getDeviceSettingsForMultipleDevices(deviceInfoArray);

    // Tracking moved after processedNotifications is defined

    // Get user-bucket relationships for snooze checking if bucketId is provided
    let userBucketMap: Map<string, any> | undefined;
    if (bucketId && userIds.length > 0) {
      const userBuckets =
        await this.bucketsService.findUserBucketsByBucketAndUsers(
          bucketId,
          userIds,
        );
      userBucketMap = new Map(userBuckets.map((ub) => [ub.userId, ub]));
    }

    // Process notifications to add attachment URLs
    const processedNotifications = this.urlBuilderService.processNotifications(
      notifications,
    );

    const deviceIdToDevice: Record<string, UserDevice> = Object.fromEntries(
      targetDevices.map((d) => [d.id, d]),
    );

    // Track notification events for each device (skip if this is from admin notification to prevent infinite loop)
    if (!skipNotificationTracking) {
      for (const device of targetDevices) {
        const deviceNotification = processedNotifications.find((n) => n.userDeviceId === device.id);
        await this.eventTrackingService.trackNotification(
          device.userId,
          device.id,
          deviceNotification?.id,
        );
      }
    }

    let successCount = 0;
    let errorCount = 0;
    let snoozedCount = 0;
    const errors: string[] = [];
    let iosSent = 0;
    let androidSent = 0;
    let webSent = 0;

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

      // If device is local-only, skip external push
      if (device.onlyLocal) {
        continue;
      }

      // Check if bucket is snoozed for this user before sending push
      if (bucketId && userBucketMap) {
        const isSnoozed = this.isBucketSnoozedForUserFromData(
          bucketId,
          device.userId,
          userBucketMap.get(device.userId),
        );

        if (isSnoozed) {
          snoozedCount++;
          continue;
        }
      }

      // Get device-specific settings
      const deviceSettings = deviceSettingsMap.get(device.id);


      const result = await this.dispatchPush(notif, device, deviceSettings);
      try {
        if (result.success) {
          successCount++;
          if (device.platform === DevicePlatform.IOS) iosSent++;
          else if (device.platform === DevicePlatform.ANDROID) androidSent++;
          else if (device.platform === DevicePlatform.WEB) webSent++;
          await this.notificationsRepository.update(notif.id, {
            sentAt: new Date(),
          });
        } else if (result.error) {
          errorCount++;
          errors.push(`Device ${device.id}: ${result.error}`);
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
                  successCount++;
                  errorCount--;
                  errors.pop(); // Remove the last error
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
      } catch (updateError) {
        this.logger.error(
          `Failed to update notification ${notif.id} after send attempt`,
          updateError,
        );
      }
    }

    return {
      processedNotifications,
      successCount,
      errorCount,
      snoozedCount,
      errors,
      androidSent,
      iosSent,
      webSent
    };
  }

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
    skipNotificationTracking = false,
    addReminderPrefix = false,
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
    }

    if (authorizedUsers.length === 0) {
      this.logger.warn(
        `No authorized users found for bucket ${message.bucketId}${userIds ? ` with userIds filter: ${userIds.join(', ')}` : ''}`,
      );
      return [];
    }

    // Get target devices to create notifications (sendPushToDevices will load them again internally)
    const targetDevices = await this.userDevicesRepository.find({
      where: {
        userId: In(authorizedUsers),
      },
      relations: ['user'],
      order: { lastUsed: 'DESC' },
    });

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

    // Add reminder prefix to notifications if requested
    let notificationsToSend = notificationsWithRelations;
    if (addReminderPrefix) {
      notificationsToSend = notificationsWithRelations.map(n => this.addReminderPrefix(n));
    }

    // Send push notifications (handles devices, settings, buckets, tracking internally)
    const { processedNotifications, successCount, errorCount, snoozedCount, errors, iosSent, androidSent, webSent } =
      await this.sendPushToDevices(
        notificationsToSend,
        authorizedUsers,
        message.bucketId,
        skipNotificationTracking,
      );

    // Log summary
    this.logger.log(
      `Message ${message.id} → Users [${authorizedUsers.join(',')}] → ${successCount} sent, ${errorCount} failed, ${snoozedCount} snoozed | iOS ${iosSent}, Android ${androidSent}, Web ${webSent}`,
    );

    return processedNotifications;
  }

  /**
   * Extracted push sending logic for a single notification-device pair.
   */
  public async sendPushToSingleDeviceStateless(
    notification: Notification,
    userDevice: UserDevice,
    userSettings?: AutoActionSettings,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // If userSettings not provided, fetch from database
      let settings = userSettings;
      if (!settings) {
        const userSettingsMap = await this.usersService.getMultipleUserSettings(
          userDevice.userId,
          [
            UserSettingType.AutoAddDeleteAction,
            UserSettingType.AutoAddMarkAsReadAction,
            UserSettingType.AutoAddOpenNotificationAction,
            UserSettingType.DefaultSnoozes,
            UserSettingType.DefaultPostpones,
          ],
          userDevice.id,
        );

        settings = this.buildAutoActionSettings(userSettingsMap);
      }

      if (userDevice.platform === DevicePlatform.IOS) {
        const result = await this.iosPushService.send(notification, [
          userDevice,
        ], settings);
        return { success: !!result.success, error: result.error };
      } else if (userDevice.platform === DevicePlatform.ANDROID) {
        const result = await this.firebasePushService.send(notification, [
          userDevice,
        ], settings);
        const ok = result.success && (result.successCount || 0) > 0;
        const firstError = result.results?.find((r) => !r.success)?.error;
        return { success: ok, error: ok ? undefined : firstError };
      } else if (userDevice.platform === DevicePlatform.WEB) {
        const result = await this.webPushService.send(notification, [
          userDevice,
        ], settings);
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
    userSettings?: AutoActionSettings,
  ): Promise<{ success: boolean; error?: string }> {


    // Get the push mode for this platform
    const mode = await this.getPushMode(userDevice.platform);

    // Off - don't send anything (no push, no local)
    if (mode === 'Off') {
      return { success: false, error: 'Notifications completely disabled for this platform' };
    }

    // Local - device-only notifications (no server push)
    if (mode === 'Local') {
      return { success: false, error: 'Local mode: notifications handled by device only' };
    }

    // Onboard - use local onboard push services (APN, Firebase, WebPush)
    if (mode === 'Onboard') {
      return this.sendPushToSingleDeviceStateless(notification, userDevice, userSettings);
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

  /**
   * Add postponed prefix to notification title based on locale
   */
  private addPostponedPrefix(notification: Notification): Notification {
    const locale = notification.message?.locale || 'en-EN';
    const postponedPrefix = this.localeService.getTranslatedText(
      locale as any,
      'notifications.postponed' as any,
    );

    // Clone notification and modify title
    const modifiedNotification = { ...notification };
    if (modifiedNotification.message) {
      modifiedNotification.message = {
        ...modifiedNotification.message,
        title: `${postponedPrefix} ${modifiedNotification.message.title}`,
      };
    }

    return modifiedNotification;
  }

  /**
   * Add reminder prefix to notification title based on locale
   */
  private addReminderPrefix(notification: Notification): Notification {
    const locale = notification.message?.locale || 'en-EN';
    const reminderPrefix = this.localeService.getTranslatedText(
      locale as any,
      'notifications.reminder' as any,
    );

    // Deep clone notification and modify title
    const modifiedNotification = {
      ...notification,
      message: notification.message ? {
        ...notification.message,
        title: `${reminderPrefix} ${notification.message.title}`,
      } : notification.message,
    } as Notification;

    return modifiedNotification;
  }

  /**
   * Resend an existing notification to all user devices
   * Used for postponed notifications
   */
  async resendNotification(
    notification: Notification,
    userId: string,
  ): Promise<PushResult> {
    try {

      // Add postponed prefix to title
      const modifiedNotification = this.addPostponedPrefix(notification);

      const bucketId = modifiedNotification.message?.bucketId;

      // Send push notifications (handles devices, settings, buckets, tracking internally)
      const { successCount, errorCount, snoozedCount, errors } =
        await this.sendPushToDevices(
          [modifiedNotification],
          [userId],
          bucketId,
          false, // skipNotificationTracking = false for postponed notifications
        );

      // Log summary
      const success = successCount > 0;
      this.logger.log(
        `Resend ${notification.id} → ${successCount} sent, ${errorCount} failed, ${snoozedCount} snoozed`,
      );

      return {
        success,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to resend notification ${notification.id}`,
        error,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Resend notification as reminder
   * Used for message reminders - similar to postponed but with [Reminder] prefix
   */
  async resendNotificationAsReminder(
    notification: Notification,
    userId: string,
  ): Promise<PushResult> {
    try {

      // Add reminder prefix to title
      const modifiedNotification = this.addReminderPrefix(notification);

      const bucketId = modifiedNotification.message?.bucketId;

      // Send push notifications (handles devices, settings, buckets, tracking internally)
      const { successCount, errorCount, snoozedCount, errors } =
        await this.sendPushToDevices(
          [modifiedNotification],
          [userId],
          bucketId,
          true, // skipNotificationTracking = true for reminders (no event tracking)
        );

      // Log summary
      const success = successCount > 0;
      this.logger.log(
        `Reminder ${notification.id} → ${successCount} sent, ${errorCount} failed, ${snoozedCount} snoozed`,
      );

      return {
        success,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to resend reminder notification ${notification.id}`,
        error,
      );
      return { success: false, error: error.message };
    }
  }
}
