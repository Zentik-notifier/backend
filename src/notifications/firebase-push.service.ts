import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { LocaleService } from '../common/services/locale.service';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { DevicePlatform } from '../users/dto';
import { IOSPushService } from './ios-push.service';
import { generateAutomaticActions } from './notification-actions.util';
import { MediaType, NotificationActionType } from './notifications.types';

interface FirebaseMulticastResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: Array<{
    token: string;
    success: boolean;
    error?: string;
    messageId?: string;
  }>;
}

@Injectable()
export class FirebasePushService {
  private readonly logger = new Logger(FirebasePushService.name);
  private app: admin.app.App | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly iosPushService: IOSPushService,
    private localeService: LocaleService,
  ) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      const firebaseConfig = {
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
        privateKey: this.configService
          .get<string>('FIREBASE_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n'),
        clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
      };

      if (
        !firebaseConfig.projectId ||
        !firebaseConfig.privateKey ||
        !firebaseConfig.clientEmail
      ) {
        this.logger.warn(
          'Firebase configuration missing. Firebase push notifications will be disabled. Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables.',
        );
        return;
      }

      this.app = admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
        projectId: firebaseConfig.projectId,
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.warn(
        'Failed to initialize Firebase Admin SDK (Firebase push notifications disabled):',
        error.message,
      );
      this.app = null;
    }
  }

  /**
   * Send notification to devices using Firebase Cloud Messaging
   */
  async send(
    notification: Notification,
    devices: UserDevice[],
  ): Promise<FirebaseMulticastResult> {
    if (!this.app) {
      this.logger.warn(
        'Firebase not initialized. Skipping Firebase notifications.',
      );
      return {
        success: false,
        successCount: 0,
        failureCount: devices.length,
        results: devices.map((device) => ({
          token: device.deviceToken || 'unknown',
          success: false,
          error: 'Firebase not configured',
        })),
      };
    }

    try {
      const message = notification.message;
      this.logger.log(
        `🔥 Sending Firebase notification "${message.title}" to ${devices.length} device(s)`,
      );

      if (devices.length === 0) {
        this.logger.warn('No valid FCM devices found');
        return {
          success: false,
          successCount: 0,
          failureCount: devices.length,
          results: devices.map((device) => ({
            token: device.deviceToken || 'unknown',
            success: false,
            error: 'Invalid or unsupported device token',
          })),
        };
      }

      // Prepare the message payload
      const tokens: string[] = devices
        .map((d) => d.deviceToken)
        .filter((t): t is string => typeof t === 'string' && t.length > 0);
      const firebaseMessage = await this.buildFirebaseMessage(
        notification,
        tokens,
      );
      this.logger.log(
        `Sending notification "${notification.id}" to ${devices.length} device(s)`,
      );

      // Send multicast message
      const response = await admin
        .messaging(this.app)
        .sendEachForMulticast(firebaseMessage);

      this.logger.log(
        `🔥 Firebase multicast result: ${response.successCount}/${devices.length} successful`,
      );

      // Process results
      const results: Array<{
        token: string;
        success: boolean;
        error?: string;
        messageId?: string;
      }> = [];

      response.responses.forEach((result, index) => {
        const device = devices[index];
        if (result.success) {
          results.push({
            token: device.deviceToken as string,
            success: true,
            messageId: result.messageId,
          });
          this.logger.debug(
            `✅ FCM success for device ${device.id}: ${result.messageId}`,
          );
        } else {
          const errorCode = result.error?.code || 'unknown';
          const errorMessage = result.error?.message || 'Unknown error';

          results.push({
            token: device.deviceToken as string,
            success: false,
            error: `${errorCode}: ${errorMessage}`,
          });

          this.logger.warn(
            `❌ FCM failed for device ${device.id}: ${errorCode} - ${errorMessage}`,
          );

          // Log specific error types for debugging
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            this.logger.warn(
              `Token may be invalid or expired for device ${device.id}`,
            );
          }
        }
      });

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to send Firebase notification:', error);
      throw new Error(`Firebase notification failed: ${error.message}`);
    }
  }

  /**
   * Build Firebase message payload from notification entity
   */
  public async buildFirebaseMessage(
    notification: Notification,
    tokens: string[],
  ): Promise<admin.messaging.MulticastMessage> {
    const message = notification.message;
    // Generate automatic actions for Android
    const automaticActions = generateAutomaticActions(
      notification,
      DevicePlatform.ANDROID,
      this.localeService,
    );

    const { payload: iosPayload, customPayload } =
      await this.iosPushService.buildAPNsPayload(
        notification,
        automaticActions,
      );
    // Build basic notification payload
    const payload: admin.messaging.MulticastMessage = {
      tokens,
      apns: {
        payload: {
          ...iosPayload,
          ...customPayload,
        },
      },
    };

    // Add subtitle if present (for Android compatibility in data section)
    if (message.subtitle && payload.data) {
      payload.data.subtitle = message.subtitle;
    }

    // Add attachments to data payload if present
    if (message.attachments && message.attachments.length > 0 && payload.data) {
      payload.data.attachmentData = JSON.stringify(message.attachments);

      // For Android, set a large icon if we have an image attachment
      const imageAttachment = message.attachments.find(
        (att) => att.mediaType === MediaType.IMAGE,
      );
      if (imageAttachment && payload.android?.notification) {
        payload.android.notification.imageUrl = imageAttachment.url;
      }
    }

    // Combine manual actions with automatic actions for Android
    const allActions = [...(message.actions || []), ...automaticActions];

    if (allActions.length > 0 && payload.data) {
      payload.data.actions = JSON.stringify(allActions);
    }

    // Add tap action (for Android compatibility in data section)
    if (payload.data) {
      const effectiveTapAction = message.tapAction
        ? message.tapAction
        : ({
            type: NotificationActionType.OPEN_NOTIFICATION,
            value: notification.id,
          } as any);
      payload.data.tapAction = JSON.stringify(effectiveTapAction);
    }

    return payload;
  }

  /**
   * Send a prebuilt FCM multicast message as-is (passthrough server).
   */
  public async sendPrebuilt(
    deviceData: { token: string },
    payload: admin.messaging.MulticastMessage,
  ): Promise<FirebaseMulticastResult> {
    if (!this.app) {
      return {
        success: false,
        successCount: 0,
        failureCount: 1,
        results: [
          {
            token: deviceData?.token || 'unknown',
            success: false,
            error: 'Firebase not configured',
          },
        ],
      };
    }

    const tokens =
      Array.isArray(payload?.tokens) && payload.tokens.length > 0
        ? payload.tokens
        : [deviceData.token];
    const toSend: admin.messaging.MulticastMessage = { ...payload, tokens };
    const response = await admin
      .messaging(this.app)
      .sendEachForMulticast(toSend);

    const results = response.responses.map((r, idx) => ({
      token: tokens[idx],
      success: r.success,
      error: r.success ? undefined : r.error?.message,
      messageId: r.success ? r.messageId : undefined,
    }));

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      results,
    };
  }

  /**
   * Validate FCM token format
   */
  isValidFCMToken(token: string): boolean {
    // FCM registration tokens are typically 152+ characters long and contain alphanumeric characters, colons, and underscores
    if (!token) return false;
    return token.length >= 140 && /^[a-zA-Z0-9:_-]+$/.test(token);
  }

  /**
   * Get Firebase app instance for advanced operations
   */
  getApp(): admin.app.App | null {
    return this.app;
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    if (!this.app) {
      return;
    }

    try {
      await this.app.delete();
      this.logger.log('Firebase app shut down successfully');
    } catch (error) {
      this.logger.error('Error shutting down Firebase app:', error);
    }
  }
}
