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

    const payload = JSON.stringify(this.buildWebPayload(notification));
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

  /**
   * Build a web push payload object (not stringified) from a notification.
   */
  public buildWebPayload(notification: Notification): any {
    const message = notification.message as any;

    const webActions = (message?.actions || []).map((a: any) => ({
      action: `${a.type}:${a.value}`,
      title: a.title || a.value,
      icon: a.icon,
      destructive: !!a.destructive,
    }));

    const imageUrl = (message?.attachments || []).find(
      (att: any) =>
        att?.url &&
        (att.mediaType === MediaType.IMAGE ||
          att.mediaType === MediaType.GIF ||
          att.mediaType === MediaType.ICON),
    )?.url;

    let url: string | undefined = '/';
    if (
      message?.tapAction?.type === NotificationActionType.NAVIGATE &&
      message?.tapAction?.value
    ) {
      url = message.tapAction.value;
    }

    return {
      title: message?.title || 'Zentik',
      body: message?.body || '',
      image: imageUrl,
      url,
      notificationId: notification.id,
      bucketId: message?.bucketId,
      deliveryType: message?.deliveryType,
      locale: message?.locale,
      sound: message?.sound,
      badge: 1,
      actions: webActions,
      tapAction: message?.tapAction,
      attachments: message?.attachments,
      addMarkAsReadAction: !!message?.addMarkAsReadAction,
      addOpenNotificationAction: !!message?.addOpenNotificationAction,
      addDeleteAction: !!message?.addDeleteAction,
      snoozes: message?.snoozes || [],
    } as any;
  }

  public async sendPrebuilt(
    deviceData: { endpoint: string; p256dh: string; auth: string; publicKey: string; privateKey: string },
    payload: string,
  ): Promise<WebPushSendResult> {
    if (!this.configured) {
      return { success: false, results: [] };
    }

    const { endpoint, p256dh, auth, publicKey, privateKey } = deviceData || ({} as any);
    if (!endpoint || !p256dh || !auth) {
      return { success: false, results: [{ endpoint: endpoint || '', success: false, error: 'Missing subscription fields' }] };
    }
    if (!publicKey || !privateKey) {
      return { success: false, results: [{ endpoint, success: false, error: 'Missing VAPID key pair' }] };
    }

    const sub = {
      endpoint,
      keys: { p256dh, auth },
    } as any;

    try {
      const subject = process.env.VAPID_SUBJECT || 'mailto:gianlucaruoccoios@gmail.com';
      await this.webpush.sendNotification(sub, payload, {
        vapidDetails: { subject, publicKey, privateKey },
      });
      return { success: true, results: [{ endpoint, success: true }] };
    } catch (error: any) {
      return { success: false, results: [{ endpoint, success: false, error: error?.message || String(error) }] };
    }
  }
}
