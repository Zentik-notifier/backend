import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { MediaType, NotificationActionType } from './notifications.types';

interface WebPushSendResult {
  success: boolean;
  results: Array<{ endpoint: string; success: boolean; error?: string }>;
}

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private webpush = webpush;
  private configured = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Service is configured as long as web-push module is available
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

  public async send(
    notification: Notification,
    devices: UserDevice[],
  ): Promise<WebPushSendResult> {
    if (!this.configured) {
      this.logger.warn('Web Push not configured. Skipping send.');
      return { success: false, results: [] };
    }

    const message = notification.message;

    // Map actions for Web Notification API and keep full action payload in data
    const webActions = (message?.actions || []).map((a) => ({
      action: `${a.type}:${a.value}`,
      title: a.title || a.value,
      icon: a.icon,
      destructive: !!a.destructive,
    }));

    // Choose a hero image from attachments if available
    const imageUrl = (message?.attachments || []).find(
      (att) =>
        att?.url &&
        (att.mediaType === MediaType.IMAGE ||
          att.mediaType === MediaType.GIF ||
          att.mediaType === MediaType.ICON),
    )?.url;

    // Derive URL from tapAction when it is a navigation
    let url: string | undefined = '/';
    if (
      message?.tapAction?.type === NotificationActionType.NAVIGATE &&
      message?.tapAction?.value
    ) {
      url = message.tapAction.value;
    }

    const payload = JSON.stringify({
      // Display fields
      title: message?.title || 'Zentik',
      body: message?.body || '',
      image: imageUrl,

      // Metadata
      url,
      notificationId: notification.id,
      bucketId: message?.bucketId,
      deliveryType: message?.deliveryType,
      locale: message?.locale,
      sound: message?.sound,

      // Badge count
      badge: 1, // Increment badge count by 1 for each notification

      // Custom data used by client
      actions: webActions,
      tapAction: message?.tapAction,
      attachments: message?.attachments,
      addMarkAsReadAction: !!message?.addMarkAsReadAction,
      addOpenNotificationAction: !!message?.addOpenNotificationAction,
      addDeleteAction: !!message?.addDeleteAction,
      snoozes: message?.snoozes || [],
    });
    // console.log('payload', payload);

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
      const sub = {
        endpoint,
        keys: {
          p256dh: device.subscriptionFields.p256dh,
          auth: device.subscriptionFields.auth,
        },
      } as any;

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
        const subject =
          process.env.VAPID_SUBJECT || 'mailto:gianlucaruoccoios@gmail.com';
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
}
