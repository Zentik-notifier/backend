import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { LocaleService } from '../common/services/locale.service';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { DevicePlatform } from '../users/dto';
import { IOSPushService } from './ios-push.service';
import { AutoActionSettings, generateAutomaticActions } from './notification-actions.util';
import { MediaType, NotificationActionType } from './notifications.types';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

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
  privatizedPayload?: any;
}

@Injectable()
export class FirebasePushService {
  private readonly logger = new Logger(FirebasePushService.name);
  private app: admin.app.App | null = null;
  private initialized = false;

  constructor(
    private readonly iosPushService: IOSPushService,
    private localeService: LocaleService,
    private serverSettingsService: ServerSettingsService,
  ) { }

  /**
   * Ensure Firebase is initialized before use (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.initializeFirebase();
    this.initialized = true;
  }

  private async initializeFirebase(): Promise<void> {
    try {
      const projectId = (await this.serverSettingsService.getSettingByType(ServerSettingType.FirebaseProjectId))?.valueText;
      const privateKey = (await this.serverSettingsService.getSettingByType(ServerSettingType.FirebasePrivateKey))?.valueText?.replace(/\\n/g, '\n');
      const clientEmail = (await this.serverSettingsService.getSettingByType(ServerSettingType.FirebaseClientEmail))?.valueText;

      if (!projectId || !privateKey || !clientEmail) {
        this.logger.warn(
          'Firebase configuration missing. Firebase push notifications will be disabled. Please set FirebaseProjectId, FirebasePrivateKey, and FirebaseClientEmail in server settings.',
        );
        return;
      }

      const firebaseConfig = {
        projectId,
        privateKey,
        clientEmail,
      };

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
    userSettings?: AutoActionSettings,
  ): Promise<FirebaseMulticastResult> {
    await this.ensureInitialized();

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
      const { message: firebaseMessage, privatizedPayload } = await this.buildFirebaseMessage(
        notification,
        tokens,
        userSettings,
      );
      this.logger.debug(
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
        privatizedPayload,
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
    deviceTokens: string[],
    userSettings?: AutoActionSettings,
  ): Promise<{ message: admin.messaging.MulticastMessage; privatizedPayload: admin.messaging.MulticastMessage }> {
    const message = notification.message;
    // Generate automatic actions for Android
    const automaticActions = generateAutomaticActions(
      notification,
      DevicePlatform.ANDROID,
      this.localeService,
      userSettings,
    );

    const { payload: iosPayload } =
      await this.iosPushService.buildAPNsPayload(
        notification,
        userSettings,
      );
    // Build basic notification payload
    const payload: admin.messaging.MulticastMessage = {
      tokens: deviceTokens,
      apns: {
        payload: {
          ...iosPayload
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

    // Privatize sensitive fields in payload before returning
    const privatizedPayload = this.privatizeFirebasePayload(payload);
    return {
      message: payload,
      privatizedPayload,
    };
  }

  /**
   * Privatize sensitive fields in Firebase payload for logging/tracking purposes
   * Returns a copy of the payload with sensitive fields privatized
   */
  private privatizeFirebasePayload(payload: admin.messaging.MulticastMessage): admin.messaging.MulticastMessage {
    const privatized = JSON.parse(JSON.stringify(payload)); // Deep copy

    // Privatize iOS payload if present (contains sensitive data)
    if (privatized.apns?.payload) {
      if (privatized.apns.payload.enc) {
        privatized.apns.payload.enc = `${String(privatized.apns.payload.enc).substring(0, 20)}...`;
      }
      if (privatized.apns.payload.tit) {
        privatized.apns.payload.tit = `${String(privatized.apns.payload.tit).substring(0, 5)}...`;
      }
      if (privatized.apns.payload.bdy) {
        privatized.apns.payload.bdy = `${String(privatized.apns.payload.bdy).substring(0, 5)}...`;
      }
      if (privatized.apns.payload.stl) {
        privatized.apns.payload.stl = `${String(privatized.apns.payload.stl).substring(0, 5)}...`;
      }
      if (privatized.apns.payload.att) {
        privatized.apns.payload.att = Array.isArray(privatized.apns.payload.att)
          ? [`${privatized.apns.payload.att[0]?.substring(0, 10) || ''}...`]
          : `${String(privatized.apns.payload.att).substring(0, 10)}...`;
      }
      if (privatized.apns.payload.tap) {
        privatized.apns.payload.tap = {
          ...privatized.apns.payload.tap,
          value: privatized.apns.payload.tap.value ? `${String(privatized.apns.payload.tap.value).substring(0, 8)}...` : privatized.apns.payload.tap.value,
        };
      }
    }

    // Privatize Android data fields if present
    if (privatized.data) {
      if (privatized.data.subtitle) {
        privatized.data.subtitle = `${String(privatized.data.subtitle).substring(0, 5)}...`;
      }
      if (privatized.data.attachmentData) {
        privatized.data.attachmentData = `${String(privatized.data.attachmentData).substring(0, 20)}...`;
      }
      if (privatized.data.tapAction) {
        try {
          const tapAction = JSON.parse(privatized.data.tapAction);
          if (tapAction.value) {
            tapAction.value = `${String(tapAction.value).substring(0, 8)}...`;
            privatized.data.tapAction = JSON.stringify(tapAction);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Keep tokens, android, apns structure unchanged
    return privatized;
  }

  /**
   * Send a prebuilt FCM multicast message as-is (passthrough server).
   */
  public async sendPrebuilt(
    deviceData: { token: string },
    payload: admin.messaging.MulticastMessage,
  ): Promise<FirebaseMulticastResult> {
    await this.ensureInitialized();

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
