import { Injectable, Logger } from '@nestjs/common';
import * as apn from 'node-apn';
import { Aps } from 'node-apn';
import { LocaleService } from '../common/services/locale.service';
import { encryptWithPublicKey } from '../common/utils/cryptoUtils';
import { NotificationAction } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { DevicePlatform } from '../users/dto';
import { AutoActionSettings, generateAutomaticActions } from './notification-actions.util';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from './notifications.types';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

export interface NotificationResult {
  token: string;
  result?: any;
  error?: string;
  payloadTooLarge?: boolean;
  retriedWithoutEncryption?: boolean;
  retrySuccess?: boolean;
}

export interface SendResult {
  success: boolean;
  results?: NotificationResult[];
  error?: string;
  payloadTooLargeDetected?: boolean;
  retryAttempted?: boolean;
  privatizedPayload?: any;
}

@Injectable()
export class IOSPushService {
  private readonly logger = new Logger(IOSPushService.name);
  private provider: apn.Provider | null = null;
  private initialized = false;

  constructor(
    private localeService: LocaleService,
    private serverSettingsService: ServerSettingsService,
  ) { }

  /**
   * Ensure provider is initialized before use (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.initializeProvider();
    this.initialized = true;
  }

  private formatAttachments(attachments: any[]): string[] {
    return attachments
      .filter((att) => att.mediaType?.toUpperCase() !== MediaType.ICON)
      .map((att) => `${att.mediaType}:${att.url}`);
  };

  /**
   * Privatize sensitive fields in APNs payload for logging/tracking purposes
   * Returns a copy of the payload with sensitive fields privatized
   */
  private privatizePayload(payload: any, sensitive: any): any {
    const privatized = { ...payload };

    // Privatize encrypted blob if present
    if (privatized.enc) {
      privatized.enc = `${String(privatized.enc).substring(0, 20)}...`;

      // If there's an encrypted blob, add privatized sensitive fields to root as "sensitive"
      if (sensitive) {
        const privatizedSensitive: any = {};

        // Privatize sensitive payload fields
        if (sensitive.tit) {
          privatizedSensitive.tit = `${String(sensitive.tit).substring(0, 5)}...`;
        }
        if (sensitive.bdy) {
          privatizedSensitive.bdy = `${String(sensitive.bdy).substring(0, 5)}...`;
        }
        if (sensitive.stl) {
          privatizedSensitive.stl = `${String(sensitive.stl).substring(0, 5)}...`;
        }
        if (sensitive.att) {
          privatizedSensitive.att = Array.isArray(sensitive.att)
            ? [`${sensitive.att[0]?.substring(0, 10) || ''}...`]
            : `${String(sensitive.att).substring(0, 10)}...`;
        }
        if (sensitive.tap) {
          privatizedSensitive.tap = {
            ...sensitive.tap,
            value: sensitive.tap.value ? `${String(sensitive.tap.value).substring(0, 8)}...` : sensitive.tap.value,
          };
        }

        // Privatize sensitive actions if present
        if (sensitive.act && Array.isArray(sensitive.act)) {
          privatizedSensitive.act = sensitive.act.map((action: any) => ({
            ...action,
            value: action.value ? `${String(action.value).substring(0, 8)}...` : action.value,
            title: action.title ? `${String(action.title).substring(0, 5)}...` : action.title,
          }));
        }

        privatized.sensitive = privatizedSensitive;
      }
    }

    // Privatize sensitive fields if present (non-encrypted payload)
    if (privatized.tit) {
      privatized.tit = `${String(privatized.tit).substring(0, 5)}...`;
    }
    if (privatized.bdy) {
      privatized.bdy = `${String(privatized.bdy).substring(0, 5)}...`;
    }
    if (privatized.stl) {
      privatized.stl = `${String(privatized.stl).substring(0, 5)}...`;
    }
    if (privatized.att) {
      privatized.att = Array.isArray(privatized.att)
        ? [`${privatized.att[0]?.substring(0, 10) || ''}...`]
        : `${String(privatized.att).substring(0, 10)}...`;
    }
    if (privatized.tap) {
      privatized.tap = {
        ...privatized.tap,
        value: privatized.tap.value ? `${String(privatized.tap.value).substring(0, 8)}...` : privatized.tap.value,
      };
    }

    // Keep aps, nid, bid, mid, dty, act (public actions) unchanged
    return privatized;
  }

  /**
   * Build APNs payload for iOS notifications
   * Creates a complete payload with only the 'aps' key and custom data
   * If publicKey is provided, encrypts sensitive fields in-place.
   * Updates device badge count in the database if device is provided.
   */
  public async buildAPNsPayload(
    notification: Notification,
    userSettings?: AutoActionSettings,
    device?: UserDevice,
  ) {
    const message = notification.message;

    const automaticActions = generateAutomaticActions(
      notification,
      DevicePlatform.IOS,
      this.localeService,
      userSettings,
    );

    const apsPayload: Aps = {
      alert: {
        title: notification.message.title,
        body: notification.message.body,
      },
      sound: message.sound || 'default',
      'mutable-content': 1,
      'content-available': 1,
    };

    if (message.collapseId) {
      apsPayload['apns-collapse-id'] = message.collapseId;
    } else {
      apsPayload['thread-id'] = message.groupId || notification.message.bucketId
    }


    let priority = 10;
    // Configure delivery type based on notification.deliveryType
    if (message.deliveryType === NotificationDeliveryType.CRITICAL) {
      apsPayload['interruption-level'] = 'time-sensitive';
      apsPayload['relevance-score'] = 1.0;

      // Use critical sound if no custom sound specified
      if (!message.sound) {
        apsPayload.sound = 'critical';
      }
    } else if (message.deliveryType === NotificationDeliveryType.NORMAL) {
      apsPayload['interruption-level'] = 'active';
    } else if (message.deliveryType === NotificationDeliveryType.SILENT) {
      apsPayload['interruption-level'] = 'passive';
      apsPayload['content-available'] = 1;
      priority = 5;

      // Remove alert fields for silent delivery
      delete apsPayload.alert;
      delete apsPayload.sound;
    }

    // Combine manual actions with automatic actions
    const allActions = [
      ...automaticActions,
      ...(message.actions || []),
    ];

    // Determine effective tapAction: use provided one or default to OPEN_NOTIFICATION with notification.id
    const effectiveTapAction: NotificationAction = message.tapAction
      ? message.tapAction
      : {
        type: NotificationActionType.OPEN_NOTIFICATION,
        value: notification.id,
      };

    // Separate actions: NAVIGATE/BACKGROUND_CALL go in encrypted blob, others outside
    const sensitiveActions = allActions.filter(
      (action) =>
        action.type === NotificationActionType.NAVIGATE ||
        action.type === NotificationActionType.BACKGROUND_CALL,
    );
    const publicActions = allActions.filter(
      (action) =>
        action.type !== NotificationActionType.NAVIGATE &&
        action.type !== NotificationActionType.BACKGROUND_CALL,
    ) || [];

    let payload: any = {
      aps: apsPayload,
      nid: notification.id,
      bid: message.bucketId,
      mid: message.id,
      dty: message.deliveryType,
    };

    const sensitivePayload = {
      tit: message.title,
      bdy: message.body,
      stl: message.subtitle,
      att: this.formatAttachments(message.attachments || []),
      tap: effectiveTapAction,
    };

    // If device publicKey is present, pack all sensitive values in a single encrypted blob
    let sensitive: any = null;
    if (device && device.publicKey) {
      sensitive = {
        ...sensitivePayload,
      };

      if (!!sensitiveActions.length) {
        sensitive.act = sensitiveActions;
      }
      if (!!publicActions.length) {
        payload.act = publicActions;
      }

      const enc = await encryptWithPublicKey(
        JSON.stringify(sensitive),
        device.publicKey,
      );
      payload.enc = enc;
      payload.aps.alert = {
        title: 'Encrypted Notification',
      };
    } else {
      payload = {
        ...payload,
        ...sensitivePayload,
      }
      if (!!allActions.length) {
        payload.act = allActions; // actions
      }
      if (!!message.attachments?.length) {
        payload.att = this.formatAttachments(message.attachments || []); // attachmentData as string array
      }
    }

    const topic = (await this.serverSettingsService.getSettingByType(ServerSettingType.ApnBundleId))?.valueText || 'com.apocaliss92.zentik';
    const notification_apn = new apn.Notification();
    notification_apn.rawPayload = payload;
    notification_apn.priority = priority;
    notification_apn.topic = topic

    // Privatize sensitive fields in the final payload that will be sent (notification_apn.rawPayload)
    // Create a deep copy to avoid modifying the original payload that will be sent
    const finalPayload = notification_apn.rawPayload;
    // Pass the full sensitive object (including act if present) for encryption case, or just sensitivePayload for non-encrypted
    const sensitiveForPrivatization = sensitive || sensitivePayload;
    const privatizedPayload = this.privatizePayload(JSON.parse(JSON.stringify(finalPayload)), sensitiveForPrivatization);

    return {
      payload,
      priority,
      topic,
      privatizedPayload,
      notification_apn,
    };
  }

  private async initializeProvider(): Promise<void> {
    try {
      const keyId = (await this.serverSettingsService.getSettingByType(ServerSettingType.ApnKeyId))?.valueText;
      const teamId = (await this.serverSettingsService.getSettingByType(ServerSettingType.ApnTeamId))?.valueText;
      const keyPath = (await this.serverSettingsService.getSettingByType(ServerSettingType.ApnPrivateKeyPath))?.valueText;
      const isProduction = (await this.serverSettingsService.getSettingByType(ServerSettingType.ApnProduction))?.valueBool ?? true;
      const bundleId = (await this.serverSettingsService.getSettingByType(ServerSettingType.ApnBundleId))?.valueText;

      // Enhanced logging for diagnostics
      this.logger.log(`=== APNs Configuration Diagnostics ===`);
      this.logger.log(`APN_PRODUCTION: ${isProduction}`);
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
    userSettings?: AutoActionSettings,
  ): Promise<SendResult> {
    await this.ensureInitialized();

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

    this.logger.debug(
      `Sending notification "${notification.id}" to ${deviceTokens.length} device(s)`,
    );

    if (!this.provider) {
      throw new Error('APNs provider not initialized');
    }

    try {
      // Send to all device tokens, encrypting per-device sensitive values in build
      const results: NotificationResult[] = [];
      let payloadTooLargeDetected = false;
      let retryAttempted = false;

      const privatizedPayload: any[] = [];

      for (const token of deviceTokens) {
        try {
          const device = devices.find((d) => d.deviceToken === token);
          const {
            notification_apn,
            privatizedPayload: privatizedPayloadForToken,
          } = await this.buildAPNsPayload(
            notification,
            userSettings,
            device || undefined, // Pass the found device or undefined if not found
          );

          privatizedPayload.push(privatizedPayloadForToken);

          const result = await this.provider.send(notification_apn, token);

          const resultEntry: NotificationResult = {
            token,
            result,
            payloadTooLarge: false,
            retriedWithoutEncryption: false,
            retrySuccess: false,
          };
          results.push(resultEntry);

          if (result.failed && result.failed.length > 0) {
            // Enhanced error logging for APN issues
            for (const failedResult of result.failed) {
              this.logger.error(
                `❌ APN Error for token ${token.substring(0, 8)}...:`,
              );
              this.logger.error(`  Status: ${failedResult.status}`);
              this.logger.error(
                `  Response: ${JSON.stringify(failedResult.response)}`,
              );

              // Retry strategy for PayloadTooLarge: resend without encryption (guarded by user setting)
              const statusCode = Number(failedResult.status);
              const reason = (failedResult)?.response?.reason;
              if (
                (statusCode === 403 || statusCode === 413) &&
                reason === 'PayloadTooLarge'
              ) {
                // Mark flags
                resultEntry.payloadTooLarge = true;
                payloadTooLargeDetected = true;

                // NOTE: the decision to retry will be checked upstream by orchestrator per user setting
                this.logger.warn(
                  `📦 PayloadTooLarge detected (status ${statusCode}). Retrying without encryption...`,
                );
                try {
                  retryAttempted = true;
                  resultEntry.retriedWithoutEncryption = true;

                  // Rebuild payload WITHOUT encryption by omitting device when building
                  const { notification_apn } = await this.buildAPNsPayload(
                    notification,
                    userSettings,
                    undefined,
                  );


                  const retryResult = await this.provider!.send(
                    notification_apn,
                    token,
                  );

                  const retrySuccess = !retryResult.failed || retryResult.failed.length === 0;
                  resultEntry.retrySuccess = retrySuccess;
                  resultEntry.result = retryResult; // Update with retry result

                  results.push({
                    token,
                    result: retryResult,
                    payloadTooLarge: true,
                    retriedWithoutEncryption: true,
                    retrySuccess,
                  });

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
                  resultEntry.retrySuccess = false;
                  results.push({
                    token,
                    error: retryError?.message,
                    payloadTooLarge: true,
                    retriedWithoutEncryption: true,
                    retrySuccess: false,
                  });
                }
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
            }
          } else {
            // this.logger.log(
            //   `✅ Successfully sent notification to ${token.substring(0, 8)}...`,
            // );
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
        payloadTooLargeDetected,
        retryAttempted,
        privatizedPayload,
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
  async sendPrebuilt(
    body: any,
  ): Promise<SendResult> {
    await this.ensureInitialized();
    const { deviceData: { token }, payload: payloadData } = body;

    if (!this.provider) {
      this.logger.error('APNs provider not initialized');
      throw new Error('APNs provider not initialized');
    }

    // Extract payload structure: { payload, priority, topic }
    const { payload: rawPayload, priority, topic } = payloadData;

    // Reconstruct apn.Notification from components
    const notification_apn = new apn.Notification();
    notification_apn.rawPayload = rawPayload;
    notification_apn.priority = priority;
    notification_apn.topic = topic;

    this.logger.log(`Sending APN notification to token: ${token} and topic ${topic} with priority ${priority}`);
    const result = await this.provider.send(notification_apn, token);

    this.logger.log(
      `APN send result: ${JSON.stringify({ failed: result.failed, sent: result.sent })}`,
    );

    const ok = !result.failed || result.failed.length === 0;
    return { success: ok, results: [{ token, result }] };
  }

  async shutdown(): Promise<void> {
    if (this.provider) {
      this.provider.shutdown();
      this.logger.log('APNs provider shut down');
    }
  }
}
