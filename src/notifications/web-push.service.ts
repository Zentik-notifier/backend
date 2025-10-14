import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { MediaType, NotificationActionType } from './notifications.types';
import { AutoActionSettings, generateAutomaticActions } from './notification-actions.util';
import { DevicePlatform } from '../users/dto';
import { LocaleService } from '../common/services/locale.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

interface WebPushSendResult {
  success: boolean;
  results: Array<{ endpoint: string; success: boolean; error?: string }>;
}

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private webpush = webpush;
  private configured = false;
  private vapidSubject: string | null = null;

  constructor(
    private readonly localeService: LocaleService,
    private serverSettingsService: ServerSettingsService,
  ) {}

  /**
   * Ensure service is initialized (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.configured) return;
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Service is configured as long as web-push module is available
      this.vapidSubject = (await this.serverSettingsService.getSettingByType(ServerSettingType.VapidSubject))?.valueText || null;
      this.configured = true;
      this.logger.log('Web Push service initialized (device-level keys only)');
    } catch (err) {
      this.logger.warn(
        'web-push module not available. Web push disabled until dependency is installed.',
        err?.message || err,
      );
      this.configured = false;
    }
  }

  async send(
    notification: Notification,
    devices: UserDevice[],
    userSettings?: AutoActionSettings,
  ): Promise<WebPushSendResult> {
    await this.ensureInitialized();

    if (!this.configured) {
      this.logger.warn('Web Push not configured. Skipping send.');
      return { success: false, results: [] };
    }

    const payload = JSON.stringify(this.buildWebPayload(notification, userSettings));

    const results: Array<{
      endpoint: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const device of devices) {
      if (!device.subscriptionFields) {
        this.logger.warn(
          `Skipping web push for endpoint ${device.id}: missing subscription fields`,
        );
        continue;
      }

      const endpoint = device.subscriptionFields.endpoint as string;
      const sub: any = {
        endpoint,
        keys: {
          p256dh: device.subscriptionFields.p256dh,
          auth: device.subscriptionFields.auth,
        },
      };

      try {
        // Use device-specific VAPID keys
        if (!device.publicKey || !device.privateKey) {
          this.logger.warn(
            `Skipping web push for endpoint ${endpoint}: missing device VAPID key pair`,
          );
          results.push({
            endpoint,
            success: false,
            error: 'Missing VAPID key pair',
          });
          continue;
        }

        const publicKey = device.publicKey;
        const privateKey = device.privateKey;
        const subject = this.vapidSubject || 'mailto:notifier@zentik.app';
        await this.webpush.sendNotification(sub, payload, {
          vapidDetails: {
            subject,
            publicKey,
            privateKey,
          },
        });
        results.push({ endpoint, success: true });
      } catch (error: any) {
        this.logger.warn(
          `Web push failed for endpoint ${sub.endpoint}: ${JSON.stringify(error)}`,
        );
        results.push({
          endpoint,
          success: false,
          error: error?.message || String(error),
        });
      }
    }

    const success = results.some((r) => r.success);
    return { success, results };
  }

  /**
   * Build a web push payload object (not stringified) from a notification.
   */
  buildWebPayload(
    notification: Notification,
    userSettings?: AutoActionSettings,
  ): any {
    const message = notification.message;

    // Generate automatic actions for web (same as iOS/Android)
    const automaticActions = generateAutomaticActions(
      notification,
      DevicePlatform.WEB,
      this.localeService,
      userSettings,
    );

    // Combine manual actions with automatic actions
    const allActions = [...(message?.actions || []), ...automaticActions];

    const imageUrl = (message?.attachments || []).find(
      (att) =>
        att?.url &&
        (att.mediaType === MediaType.IMAGE ||
          att.mediaType === MediaType.GIF ||
          att.mediaType === MediaType.ICON),
    )?.url;

    // Determine tap URL based on tapAction type (similar to iOS implementation)
    let url: string | undefined = '/';
    const effectiveTapAction = message.tapAction || {
      type: NotificationActionType.OPEN_NOTIFICATION,
      value: notification.id,
    };

    if (
      effectiveTapAction.type === NotificationActionType.NAVIGATE &&
      effectiveTapAction.value
    ) {
      url = effectiveTapAction.value;
    } else if (
      effectiveTapAction.type === NotificationActionType.OPEN_NOTIFICATION
    ) {
      // For OPEN_NOTIFICATION, navigate to notification detail page
      url = `/notifications/${effectiveTapAction.value || notification.id}`;
    }

    return {
      title: message?.title || 'Zentik',
      body: message?.body || '',
      image: imageUrl,
      url,
      notificationId: notification.id,
      bucketId: message?.bucketId,
      bucketIcon: message?.bucket.icon,
      bucketName: message?.bucket.name,
      deliveryType: message?.deliveryType,
      locale: message?.locale,
      sound: message?.sound,
      badge: 1,
      actions: allActions,
      tapAction: effectiveTapAction,
      attachments: message?.attachments,
      addMarkAsReadAction: !!message?.addMarkAsReadAction,
      addOpenNotificationAction: !!message?.addOpenNotificationAction,
      addDeleteAction: !!message?.addDeleteAction,
      snoozes: message?.snoozes || [],
    };
  }

  public async sendPrebuilt(
    deviceData: {
      endpoint: string;
      p256dh: string;
      auth: string;
      publicKey: string;
      privateKey: string;
    },
    payload: string,
  ): Promise<WebPushSendResult> {
    await this.ensureInitialized();

    if (!this.configured) {
      return { success: false, results: [] };
    }

    const { endpoint, p256dh, auth, publicKey, privateKey } = deviceData || {};
    if (!endpoint || !p256dh || !auth) {
      return {
        success: false,
        results: [
          {
            endpoint: endpoint || '',
            success: false,
            error: 'Missing subscription fields',
          },
        ],
      };
    }
    if (!publicKey || !privateKey) {
      return {
        success: false,
        results: [
          { endpoint, success: false, error: 'Missing VAPID key pair' },
        ],
      };
    }

    const sub = {
      endpoint,
      keys: { p256dh, auth },
    };

    try {
      const subject = this.vapidSubject || 'mailto:gianlucaruoccoios@gmail.com';
      await this.webpush.sendNotification(sub, payload, {
        vapidDetails: { subject, publicKey, privateKey },
      });
      return { success: true, results: [{ endpoint, success: true }] };
    } catch (error: any) {
      return {
        success: false,
        results: [
          { endpoint, success: false, error: error?.message || String(error) },
        ],
      };
    }
  }
}
