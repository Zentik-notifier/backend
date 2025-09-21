import { Injectable, Logger } from '@nestjs/common';
import * as apn from 'node-apn';
import { Aps } from 'node-apn';
import { LocaleService } from '../common/services/locale.service';
import { encryptWithPublicKey } from '../common/utils/cryptoUtils';
import { NotificationAction } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { DevicePlatform } from '../users/dto';
import { generateAutomaticActions } from './notification-actions.util';
import { NotificationDeliveryType } from './notifications.types';

export interface NotificationResult {
  token: string;
  result?: any;
  error?: string;
}

export interface SendResult {
  success: boolean;
  results?: NotificationResult[];
  error?: string;
}

@Injectable()
export class IOSPushService {
  private readonly logger = new Logger(IOSPushService.name);
  private provider: apn.Provider | null = null;

  constructor(private localeService: LocaleService) {
    this.initializeProvider();
  }

  /**
   * Build APNs payload for iOS notifications
   * Creates a complete payload with only the 'aps' key and custom data
   * If publicKey is provided, encrypts sensitive fields in-place.
   * Updates device badge count in the database if device is provided.
   */
  public async buildAPNsPayload(
    notification: Notification,
    automaticActions: NotificationAction[],
    device?: UserDevice,
  ) {
    // Validate iOS action limit (maximum 10 actions total)
    const message = notification.message;

    // Build the aps payload
    const apsPayload: Aps = {
      alert: {
        title: message.title,
        body: message.body,
      },
      sound: message.sound || 'default',
      'mutable-content': 1,
      'content-available': 1,
    };
    apsPayload['thread-id'] = !message.collapseId
      ? message.groupId || notification.message.bucketId
      : undefined;

    // Add collapse ID if present
    if (message.collapseId) {
      apsPayload['apns-collapse-id'] = message.collapseId;
    }

    // Add subtitle if present
    if (message.subtitle) {
      (apsPayload.alert as any).subtitle = message.subtitle;
    }

    let priority = 10;
    // Configure delivery type based on notification.deliveryType
    if (message.deliveryType === NotificationDeliveryType.CRITICAL) {
      // Critical: Push con banner e alert critico
      apsPayload['interruption-level'] = 'time-sensitive';
      // apsPayload['interruption-level'] = 'critical';
      apsPayload['relevance-score'] = 1.0;

      // Use critical sound if no custom sound specified
      if (!message.sound) {
        apsPayload.sound = 'critical';
      }
    } else if (message.deliveryType === NotificationDeliveryType.NORMAL) {
      // Normal: Push con banner standard
      apsPayload['interruption-level'] = 'active';
    } else if (message.deliveryType === NotificationDeliveryType.SILENT) {
      // Silent: Solo app, no banner
      apsPayload['interruption-level'] = 'passive';
      apsPayload['content-available'] = 1;
      priority = 5;

      // Remove alert fields for silent delivery
      delete apsPayload.alert;
      delete apsPayload.sound;
    }

    // Combine manual actions with automatic actions
    const allActions = [
      ...(automaticActions || []),
      ...(message.actions || []),
    ];

    // Build the complete payload with only 'aps' key
    const payload: any = {
      aps: apsPayload,
    };

    // Build customPayload clone
    const customPayload = {
      // keep only non-sensitive, minimal info
      priority: priority,
    } as any;

    // Add tapAction to payload for non-encrypted devices
    if (message.tapAction && (!device || !device.publicKey)) {
      payload.tapAction = message.tapAction;
    }

    // Resolve bucket display fields for Communication Notifications (iOS)
    const bucketName: string | undefined = notification?.message?.bucket?.name;
    const bucketColor: string | undefined = notification?.message?.bucket?.color || undefined;
    const bucketIconUrl: string | undefined = notification?.message?.bucket?.icon || undefined;

    // If device publicKey is present, pack all sensitive values in a single encrypted blob
    if (device && device.publicKey) {
      const alert: any = payload.aps?.alert || {};
      const sensitive: any = {
        title: alert?.title ?? message.title,
        body: alert?.body ?? message.body,
        subtitle: alert?.subtitle ?? message.subtitle,
        notificationId: notification.id,
        bucketId: message.bucketId,
        bucketName,
        bucketIconUrl,
        bucketColor,
        actions: allActions,
        attachmentData: this.filterOutIconAttachments(message.attachments || []),
        tapAction: message.tapAction,
      };

      const enc = await encryptWithPublicKey(
        JSON.stringify(sensitive),
        device.publicKey,
      );
      // place single blob in payload
      payload.enc = enc;

      // Provide a minimal visible alert to ensure notification shows if NSE doesn't run
      if (payload.aps) {
        payload.aps.alert = {
          title: 'Encrypted Notification',
        } as any;
      }
    } else {
      // No encryption path: include essential fields directly to ensure NSE/CE can access them
      payload.notificationId = notification.id;
      payload.bucketId = message.bucketId;
      if (bucketName) payload.bucketName = bucketName;
      if (bucketIconUrl) payload.bucketIconUrl = bucketIconUrl;
      if (bucketColor) payload.bucketColor = bucketColor;
      if (allActions && allActions.length > 0) {
        payload.actions = allActions;
      }
      if (message.attachments && (message.attachments as any[]).length > 0) {
        payload.attachmentData = this.filterOutIconAttachments(message.attachments || []);
      }
    }

    return {
      customPayload,
      payload,
    };
  }

  private initializeProvider(): void {
    try {
      const keyId = process.env.APN_KEY_ID;
      const teamId = process.env.APN_TEAM_ID;
      const keyPath = process.env.APN_PRIVATE_KEY_PATH;
      const isProduction = process.env.APN_PRODUCTION === 'true';
      const bundleId = process.env.APN_BUNDLE_ID;

      // Enhanced logging for diagnostics
      this.logger.log(`=== APNs Configuration Diagnostics ===`);
      this.logger.log(`Environment: ${process.env.NODE_ENV || 'undefined'}`);
      this.logger.log(
        `APN_PRODUCTION: ${process.env.APN_PRODUCTION} (parsed as: ${isProduction})`,
      );
      this.logger.log(
        `APN_KEY_ID: ${keyId ? `${keyId.substring(0, 4)}...` : 'undefined'}`,
      );
      this.logger.log(
        `APN_TEAM_ID: ${teamId ? `${teamId.substring(0, 4)}...` : 'undefined'}`,
      );
      this.logger.log(`APN_BUNDLE_ID: ${bundleId || 'undefined'}`);
      this.logger.log(`APN_PRIVATE_KEY_PATH: ${keyPath || 'undefined'}`);

      if (!keyId || !teamId || !keyPath) {
        this.logger.warn(
          'APNs configured in mock mode for development - missing required config',
        );
        this.logger.warn(
          `Missing: ${!keyId ? 'APN_KEY_ID ' : ''}${!teamId ? 'APN_TEAM_ID ' : ''}${!keyPath ? 'APN_PRIVATE_KEY_PATH' : ''}`,
        );
        return;
      }

      // Check if key file exists
      const fs = require('fs');
      if (!fs.existsSync(keyPath)) {
        this.logger.error(`APNs private key file not found at: ${keyPath}`);

        // try {
        //   if (fs.existsSync('/data/storage')) {
        //     const storageDirs = fs.readdirSync('/data/storage');
        //     this.logger.error(`Directories in /data/storage: ${storageDirs.join(', ')}`);
        //   } else {
        //     this.logger.error('/data/storage directory does not exist');
        //   }
        // } catch (storageError) {
        //   this.logger.error(`Cannot read /data/storage directory: ${storageError.message}`);
        // }

        return;
      }

      // Validate key file content
      try {
        const keyContent = fs.readFileSync(keyPath, 'utf8');
        if (!keyContent.includes('-----BEGIN PRIVATE KEY-----')) {
          this.logger.error(
            'Invalid APN private key format - missing BEGIN PRIVATE KEY header',
          );
          return;
        }
        this.logger.log(
          `APNs private key file loaded successfully (${keyContent.length} bytes)`,
        );
      } catch (keyError) {
        this.logger.error(
          `Error reading APN private key file: ${keyError.message}`,
        );
        return;
      }

      const options: apn.ProviderOptions = {
        token: {
          key: keyPath,
          keyId: keyId,
          teamId: teamId,
        },
        production: isProduction,
      };

      this.logger.log(
        `Initializing APNs provider for ${isProduction ? 'PRODUCTION' : 'SANDBOX'} environment`,
      );

      this.provider = new apn.Provider(options);
      this.logger.log(
        `✅ APNs provider initialized successfully for ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to initialize APNs provider:', error);
      this.logger.error(
        'Error details:',
        JSON.stringify({
          message: error.message,
          stack: error.stack,
        }),
      );
    }
  }

  async send(
    notification: Notification,
    devices: UserDevice[],
  ): Promise<SendResult> {
    if (!devices || devices.length === 0) {
      throw new Error('No devices found for notification');
    }

    const deviceTokens: string[] = devices
      .map((device) => device.deviceToken)
      .filter(
        (token): token is string =>
          typeof token === 'string' && token.length > 0,
      );

    if (deviceTokens.length === 0) {
      throw new Error('No valid device tokens found for notification');
    }

    this.logger.log(
      `Sending notification "${notification.id}" to ${deviceTokens.length} device(s)`,
    );

    if (!this.provider) {
      throw new Error('APNs provider not initialized');
    }

    try {
      // Generate automatic actions for iOS
      const automaticActions = generateAutomaticActions(
        notification,
        DevicePlatform.IOS,
        this.localeService,
      );

      // Send to all device tokens, encrypting per-device sensitive values in build
      const results: NotificationResult[] = [];
      for (const token of deviceTokens) {
        try {
          const device = devices.find((d) => d.deviceToken === token);
          const {
            customPayload: { priority, ...customPayload },
            payload,
          } = await this.buildAPNsPayload(
            notification,
            automaticActions,
            device || undefined, // Pass the found device or undefined if not found
          );

          const notification_apn = new apn.Notification();
          notification_apn.rawPayload = payload;
          notification_apn.payload = customPayload;
          notification_apn.priority = priority as number;
          notification_apn.topic =
            process.env.APN_BUNDLE_ID || 'com.apocaliss92.zentik';

          const result = await this.provider.send(notification_apn, token);
          results.push({ token, result });

          if (result.failed && result.failed.length > 0) {
            // Enhanced error logging for APN issues
            result.failed.forEach((failedResult) => {
              this.logger.error(
                `❌ APN Error for token ${token.substring(0, 8)}...:`,
              );
              this.logger.error(`  Status: ${failedResult.status}`);
              this.logger.error(
                `  Response: ${JSON.stringify(failedResult.response)}`,
              );

              // Retry strategy for PayloadTooLarge: resend without encryption (guarded by user setting)
              const statusCode = Number(failedResult.status);
              const reason = (failedResult as any)?.response?.reason;
              if (
                (statusCode === 403 || statusCode === 413) &&
                reason === 'PayloadTooLarge'
              ) {
                // NOTE: the decision to retry will be checked upstream by orchestrator per user setting
                this.logger.warn(
                  `📦 PayloadTooLarge detected (status ${statusCode}). Retrying without encryption...`,
                );
                (async () => {
                  try {
                    // Rebuild payload WITHOUT encryption by omitting device when building
                    const retryBuild = await this.buildAPNsPayload(
                      notification,
                      automaticActions,
                      undefined,
                    );

                    // Ensure actions and attachments are present in retry raw payload
                    const retryNotification = new apn.Notification();
                    retryNotification.rawPayload = retryBuild.payload;
                    retryNotification.payload = retryBuild.customPayload;
                    retryNotification.priority = retryBuild.customPayload
                      .priority as number;
                    retryNotification.topic =
                      process.env.APN_BUNDLE_ID || 'com.apocaliss92.zentik';

                    const retryResult = await this.provider!.send(
                      retryNotification,
                      token,
                    );
                    results.push({ token, result: retryResult });

                    if (retryResult.failed && retryResult.failed.length > 0) {
                      this.logger.error(
                        `❌ Retry failed for token ${token.substring(0, 8)}...: ${JSON.stringify(
                          retryResult.failed,
                        )}`,
                      );
                    } else {
                      this.logger.log(
                        `✅ Retry without encryption succeeded for ${token.substring(
                          0,
                          8,
                        )}...`,
                      );
                    }
                  } catch (retryError: any) {
                    this.logger.error(
                      `❌ Retry without encryption crashed for ${token.substring(
                        0,
                        8,
                      )}...: ${retryError?.message}`,
                    );
                    results.push({ token, error: retryError?.message });
                  }
                })();
              }

              // Special handling for BadEnvironmentKeyInToken
              if (failedResult.status === 'BadEnvironmentKeyInToken') {
                this.logger.error(
                  `🔥 CRITICAL: BadEnvironmentKeyInToken detected!`,
                );
                this.logger.error(
                  `  This means the APN environment configuration is wrong.`,
                );
                this.logger.error(
                  `  Current config: APN_PRODUCTION=${process.env.APN_PRODUCTION} (${process.env.APN_PRODUCTION === 'true' ? 'PRODUCTION' : 'SANDBOX'})`,
                );
                this.logger.error(
                  `  Your p8 key might be configured for a different environment.`,
                );
                this.logger.error(
                  `  If your app is in production, ensure APN_PRODUCTION=true and your p8 key is for production.`,
                );
              }
            });
          } else {
            this.logger.log(
              `✅ Successfully sent notification to ${token.substring(0, 8)}...`,
            );
          }
        } catch (error: any) {
          this.logger.error(`Error sending notification to ${token}:`, error);
          results.push({ token, error: error.message });
        }
      }

      // Calculate success based on actual results
      const successCount = results.filter(
        (r) =>
          r.result &&
          (!r.result.failed || r.result.failed.length === 0) &&
          !r.error,
      ).length;

      return {
        success: successCount > 0,
        results,
      };
    } catch (error) {
      this.logger.error('Error sending via APNs:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send a prebuilt APNs payload as-is using controller-provided deviceData and payload.
   * deviceData: { token: string; priority?: number }
   * payload: { rawPayload, customPayload } | rawPayload
   */
  async sendPrebuilt(deviceData: { token: string }, payload: any): Promise<SendResult> {
    if (!this.provider) {
      this.logger.error('APNs provider not initialized');
      throw new Error('APNs provider not initialized');
    }
    
    const token = deviceData?.token;
    
    // Reconstruct apn.Notification from components
    const notification_apn = new apn.Notification();
    notification_apn.rawPayload = payload.rawPayload;
    notification_apn.payload = payload.customPayload;
    notification_apn.priority = payload.priority;
    notification_apn.topic = payload.topic;
    
    this.logger.log(`Sending APN notification to token: ${token}`);
    const result = await this.provider.send(notification_apn, token);
    
    this.logger.log(`APN send result: ${JSON.stringify({ failed: result.failed, sent: result.sent })}`);
    
    const ok = !result.failed || result.failed.length === 0;
    return { success: ok, results: [{ token, result }] } as any;
  }

  async shutdown(): Promise<void> {
    if (this.provider) {
      this.provider.shutdown();
      this.logger.log('APNs provider shut down');
    }
  }

  /**
   * Filters out ICON attachments from the attachments array
   * Icons should not be included in notification attachments
   */
  private filterOutIconAttachments(attachments: any[]): any[] {
    if (!attachments || !Array.isArray(attachments)) {
      return [];
    }
    
    return attachments.filter(attachment => 
      attachment.mediaType?.toUpperCase() !== 'ICON'
    );
  }
}
