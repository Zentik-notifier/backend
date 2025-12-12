import { Injectable, Logger } from '@nestjs/common';
import * as apn from 'node-apn';
import { Aps } from 'node-apn';
import { LocaleService } from '../common/services/locale.service';
import { encryptWithPublicKey } from '../common/utils/cryptoUtils';
import { NotificationAction } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { ServerSettingType } from '../entities/server-setting.entity';
import { UserDevice } from '../entities/user-device.entity';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { DevicePlatform } from '../users/dto';
import { AutoActionSettings, generateAutomaticActions } from './notification-actions.util';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from './notifications.types';
import { s } from 'graphql-ws/dist/common-DY-PBNYy';

const DeliveryTypeMap = {
  [NotificationDeliveryType.NORMAL]: 0,
  [NotificationDeliveryType.SILENT]: 1,
  [NotificationDeliveryType.CRITICAL]: 2,
  [NotificationDeliveryType.NO_PUSH]: 3,
};

const ActionTypeMap = {
  [NotificationActionType.DELETE]: 1,
  [NotificationActionType.MARK_AS_READ]: 2,
  [NotificationActionType.OPEN_NOTIFICATION]: 3,
  [NotificationActionType.NAVIGATE]: 4,
  [NotificationActionType.BACKGROUND_CALL]: 5,
  [NotificationActionType.SNOOZE]: 6,
  [NotificationActionType.POSTPONE]: 7,
  [NotificationActionType.WEBHOOK]: 8,
};

const stripDashes = (uuid: string) => uuid;
// const stripDashes = (uuid: string) => uuid.replace(/-/g, '');

export interface NotificationResult {
  token: string;
  result?: any;
  error?: string;
  payloadTooLarge?: boolean;
  retriedWithoutEncryption?: boolean;
  retrySuccess?: boolean;
  payloadSizeKB?: number;
}

export interface SendResult {
  success: boolean;
  results?: NotificationResult[];
  error?: string;
  payloadTooLargeDetected?: boolean;
  retryAttempted?: boolean;
  privatizedPayload?: any;
  averagePayloadSizeKB?: number;
  maxPayloadSizeKB?: number;
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

    // Privatize encrypted blob if present (e)
    if (privatized.e) {
      privatized.e = `${String(privatized.e).substring(0, 20)}...`;

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
        if (sensitive.tp) {
          privatizedSensitive.tp = {
            ...sensitive.tp,
            v: sensitive.tp.v ? `${String(sensitive.tp.v).substring(0, 8)}...` : sensitive.tp.v,
          };
        }

        // Privatize sensitive actions if present (a)
        if (sensitive.a && Array.isArray(sensitive.a)) {
          privatizedSensitive.a = sensitive.a.map((action: any) => ({
            ...action,
            v: action.v ? `${String(action.v).substring(0, 8)}...` : action.v,
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
    if (privatized.tp) {
      privatized.tp = {
        ...privatized.tp,
        v: privatized.tp.v ? `${String(privatized.tp.v).substring(0, 8)}...` : privatized.tp.v,
      };
    }

    // Keep aps, n, b, m, y, a (public actions) unchanged
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
    options?: { selfDownload?: boolean },
  ) {
    const isSelfDownload = options?.selfDownload === true;
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
    ].map((action) => {
      const optimized: any = {
        ...action,
        t: ActionTypeMap[action.type] || 0,
        v: action.value,
      };

      // Optimization: remove icon for well-known actions (client maps icon 1:1)
      if (
        action.type === NotificationActionType.DELETE ||
        action.type === NotificationActionType.MARK_AS_READ ||
        action.type === NotificationActionType.OPEN_NOTIFICATION ||
        action.type === NotificationActionType.SNOOZE ||
        action.type === NotificationActionType.POSTPONE
      ) {
        delete optimized.icon;
      }

      // Optimization: remove explicit destructive=false to save bytes
      if (optimized.destructive === false) {
        delete optimized.destructive;
      }

      // Optimization: remove value for known fixed-value actions
      if (
        (action.type === NotificationActionType.DELETE) ||
        (action.type === NotificationActionType.MARK_AS_READ) ||
        (action.type === NotificationActionType.OPEN_NOTIFICATION)
      ) {
        delete optimized.v;
      }

      delete optimized.type;
      delete optimized.value;
      return optimized;
    });

    // Determine effective tapAction: use provided one or default to OPEN_NOTIFICATION with notification.id
    const effectiveTapAction: NotificationAction = message.tapAction
      ? message.tapAction
      : {
        type: NotificationActionType.OPEN_NOTIFICATION,
        value: notification.id,
      };

    const optimizedTapAction: any = {
      ...effectiveTapAction,
      t: ActionTypeMap[effectiveTapAction.type] || 0,
      v: effectiveTapAction.value,
    };

    // Optimization: remove icon for well-known tap actions
    if (
      effectiveTapAction.type === NotificationActionType.DELETE ||
      effectiveTapAction.type === NotificationActionType.MARK_AS_READ ||
      effectiveTapAction.type === NotificationActionType.OPEN_NOTIFICATION ||
      effectiveTapAction.type === NotificationActionType.SNOOZE ||
      effectiveTapAction.type === NotificationActionType.POSTPONE
    ) {
      delete optimizedTapAction.icon;
    }

    // Optimization: remove explicit destructive=false
    if (optimizedTapAction.destructive === false) {
      delete optimizedTapAction.destructive;
    }

    // Optimization: remove value for known fixed-value tap actions
    if (
      (effectiveTapAction.type === NotificationActionType.DELETE && effectiveTapAction.value === 'delete_notification') ||
      (effectiveTapAction.type === NotificationActionType.MARK_AS_READ && effectiveTapAction.value === 'mark_as_read_notification') ||
      (effectiveTapAction.type === NotificationActionType.OPEN_NOTIFICATION && effectiveTapAction.value === notification.id)
    ) {
      delete optimizedTapAction.v;
    }

    delete optimizedTapAction.type;
    delete optimizedTapAction.value;

    // Separate actions: NAVIGATE/BACKGROUND_CALL go in encrypted blob, others outside
    // We check the original type from the map (reverse lookup would be needed or check the mapped value)
    // NAVIGATE is 4, BACKGROUND_CALL is 5
    const sensitiveActions = allActions.filter(
      (action) =>
        action.t === ActionTypeMap[NotificationActionType.NAVIGATE] ||
        action.t === ActionTypeMap[NotificationActionType.BACKGROUND_CALL],
    );
    const publicActions = allActions.filter(
      (action) =>
        action.t !== ActionTypeMap[NotificationActionType.NAVIGATE] &&
        action.t !== ActionTypeMap[NotificationActionType.BACKGROUND_CALL],
    ) || [];

    let payload: any = {
      aps: apsPayload,
      n: stripDashes(notification.id),
      b: stripDashes(message.bucketId),
      m: stripDashes(message.id),
      y: DeliveryTypeMap[message.deliveryType] ?? 0,
    };

    if (message.bucket?.iconUrl) {
      payload.bi = message.bucket.iconUrl;
    }

    const sensitivePayload = {
      tit: message.title,
      bdy: message.body,
      stl: message.subtitle,
      att: this.formatAttachments(message.attachments || []),
      tp: optimizedTapAction,
    };

    // If device publicKey is present, pack all sensitive values in a single encrypted blob
    let sensitive: any = null;
    if (isSelfDownload) {
      // Minimal payload: no encrypted blob and no sensitive fields in the root
      // Add explicit selfDownload flag for clients to fetch content from the server
      (payload as any).selfDownload = true;
    } else if (device && device.publicKey) {
      sensitive = {
        ...sensitivePayload,
      };

      if (!!sensitiveActions.length) {
        sensitive.a = sensitiveActions;
      }
      if (!!publicActions.length) {
        payload.a = publicActions;
      }

      const enc = await encryptWithPublicKey(
        JSON.stringify(sensitive),
        device.publicKey,
      );
      payload.e = enc;
      payload.aps.alert = {
        title: 'Encrypted Notification',
      };
    } else {
      payload = {
        ...payload,
        ...sensitivePayload,
      }
      if (!!allActions.length) {
        payload.a = allActions; // actions
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

    // Approximate payload size (in KB) as it will be sent to APNs
    // We serialize the raw payload to JSON and measure its UTF-8 byte length.
    const payloadSizeBytes = Buffer.byteLength(
      JSON.stringify(finalPayload),
      'utf8',
    );
    const payloadSizeKB = Number((payloadSizeBytes / 1024).toFixed(2));
    let privatizedPayload: any;
    if (isSelfDownload) {
      // In selfDownload mode, we intentionally avoid including sensitive fields,
      // so we can return the payload as-is (deep-copied for safety)
      privatizedPayload = JSON.parse(JSON.stringify(finalPayload));
    } else {
      // Pass the full sensitive object (including act if present) for encryption case,
      // or just sensitivePayload for non-encrypted
      const sensitiveForPrivatization = sensitive || sensitivePayload;
      privatizedPayload = this.privatizePayload(
        JSON.parse(JSON.stringify(finalPayload)),
        sensitiveForPrivatization,
      );
    }

    return {
      payload,
      priority,
      topic,
      privatizedPayload,
      notification_apn,
      payloadSizeBytes,
      payloadSizeKB,
    };
  }

  private async initializeProvider(): Promise<void> {
    try {
      // Optional mock provider mode: keeps the full IOSPushService logic
      // identical to production while avoiding real APNs calls.
      // IOS_APN_MOCK_MODE can be:
      //  - 'success'        -> always return a green response
      //  - 'payloadTooLarge'-> always simulate a PayloadTooLarge failure
      const mockMode = (process.env.IOS_APN_MOCK_MODE || '').toLowerCase();
      if (mockMode === 'success' || mockMode === 'payloadtoolarge') {
        this.logger.warn(
          `IOS_APN_MOCK_MODE=${mockMode}: using mock APNs provider (no real APNs calls will be made)`,
        );

        const mockProvider: any = {
          send: async (_notification: apn.Notification, deviceTokens: string | string[]) => {
            const tokens = Array.isArray(deviceTokens)
              ? deviceTokens
              : [deviceTokens];

            if (mockMode === 'success') {
              return {
                sent: tokens.map((t) => ({ device: t })),
                failed: [],
              };
            }

            // mockMode === 'payloadtoolarge'
            return {
              sent: [],
              failed: tokens.map((t) => ({
                device: t,
                status: 413,
                response: { reason: 'PayloadTooLarge' },
              })),
            };
          },
          shutdown: () => {
            this.logger.log('Mock APNs provider shut down');
          },
        };

        this.provider = mockProvider as unknown as apn.Provider;
        return;
      }

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
    options?: { allowUnencryptedRetryOnPayloadTooLarge?: boolean },
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
          const subToken = `${token.substring(0, 8)}...`;
          const device = devices.find((d) => d.deviceToken === token);
          const {
            notification_apn,
            privatizedPayload: privatizedPayloadForToken,
            payloadSizeKB,
          } = await this.buildAPNsPayload(
            notification,
            userSettings,
            device || undefined, // Pass the found device or undefined if not found
          );

          this.logger.debug(
            `Sending notification "${notification.id}" to device ${subToken}. Size ${payloadSizeKB} KB`,
          );

          privatizedPayload.push(privatizedPayloadForToken);

          const result = await this.provider.send(notification_apn, token);

          const resultEntry: NotificationResult = {
            token,
            result,
            payloadTooLarge: false,
            retriedWithoutEncryption: false,
            retrySuccess: false,
            payloadSizeKB,
          };
          results.push(resultEntry);

          if (result.failed && result.failed.length > 0) {
            // Enhanced error logging for APN issues
            for (const failedResult of result.failed) {
              this.logger.error(
                `❌ APN Error for token ${subToken}: ${JSON.stringify(failedResult)}`,
              );

              // Retry strategy for PayloadTooLarge: resend without encryption (guarded by caller option)
              const statusCode = Number(failedResult.status);
              const reason = (failedResult)?.response?.reason;
              if (
                (statusCode === 403 || statusCode === 413) &&
                reason === 'PayloadTooLarge'
              ) {
                // Mark flags
                resultEntry.payloadTooLarge = true;
                payloadTooLargeDetected = true;
                let needSelfDownloadFallback = false;
                if (options?.allowUnencryptedRetryOnPayloadTooLarge) {
                  this.logger.warn(
                    `📦 PayloadTooLarge detected (status ${statusCode}). Retrying without encryption...`,
                  );
                  try {
                    retryAttempted = true;
                    resultEntry.retriedWithoutEncryption = true;

                    // Rebuild payload WITHOUT encryption by omitting device when building
                    const { notification_apn, payloadSizeKB: retryPayloadSizeKB } = await this.buildAPNsPayload(
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
                    resultEntry.payloadSizeKB = retryPayloadSizeKB;
                    needSelfDownloadFallback = !retrySuccess;

                    results.push({
                      token,
                      result: retryResult,
                      payloadTooLarge: true,
                      retriedWithoutEncryption: true,
                      retrySuccess,
                      payloadSizeKB: retryPayloadSizeKB,
                    });

                    if (retryResult.failed && retryResult.failed.length > 0) {
                      this.logger.error(
                        `❌ Retry failed for token ${token.substring(0, 8)}...: ${JSON.stringify(
                          retryResult.failed,
                        )}`,
                      );
                    } else {
                      this.logger.log(
                        `✅ Retry without encryption succeeded for ${subToken}`,
                      );
                    }
                  } catch (retryError: any) {
                    this.logger.error(
                      `❌ Retry without encryption crashed for ${subToken}: ${retryError?.message}`,
                    );
                    resultEntry.retrySuccess = false;
                    needSelfDownloadFallback = true;
                    results.push({
                      token,
                      error: retryError?.message,
                      payloadTooLarge: true,
                      retriedWithoutEncryption: true,
                      retrySuccess: false,
                    });
                  }
                } else {
                  needSelfDownloadFallback = true;
                }

                // Third strategy for PayloadTooLarge: build a minimal selfDownload payload
                if (needSelfDownloadFallback) {
                  this.logger.warn(
                    `📦 PayloadTooLarge detected. Sending minimal selfDownload payload...`,
                  );
                  try {
                    retryAttempted = true;

                    const { notification_apn: selfDownloadNotification, privatizedPayload: selfDownloadPrivatized, payloadSizeKB: selfDownloadPayloadSizeKB } =
                      await this.buildAPNsPayload(
                        notification,
                        userSettings,
                        undefined,
                        { selfDownload: true },
                      );

                    privatizedPayload.push(selfDownloadPrivatized);

                    const selfDownloadResult = await this.provider!.send(
                      selfDownloadNotification,
                      token,
                    );

                    const selfDownloadSuccess = !selfDownloadResult.failed || selfDownloadResult.failed.length === 0;
                    resultEntry.retrySuccess = selfDownloadSuccess;
                    resultEntry.result = selfDownloadResult;
                    resultEntry.payloadSizeKB = selfDownloadPayloadSizeKB;

                    results.push({
                      token,
                      result: selfDownloadResult,
                      payloadTooLarge: true,
                      retriedWithoutEncryption: false,
                      retrySuccess: selfDownloadSuccess,
                      payloadSizeKB: selfDownloadPayloadSizeKB,
                    });

                    if (selfDownloadResult.failed && selfDownloadResult.failed.length > 0) {
                      this.logger.error(
                        `❌ SelfDownload fallback failed for token ${token.substring(0, 8)}...: ${JSON.stringify(
                          selfDownloadResult.failed,
                        )}`,
                      );
                    } else {
                      this.logger.log(
                        `✅ SelfDownload fallback succeeded for ${token.substring(0, 8)}...`,
                      );
                    }
                  } catch (selfDownloadError: any) {
                    this.logger.error(
                      `❌ SelfDownload fallback crashed for ${subToken}: ${selfDownloadError?.message}`,
                    );
                    resultEntry.retrySuccess = false;
                    results.push({
                      token,
                      error: selfDownloadError?.message,
                      payloadTooLarge: true,
                      retriedWithoutEncryption: false,
                      retrySuccess: false,
                    });
                  }
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

      // Aggregate payload size statistics across all attempts
      const payloadSizes = results
        .map((r) => r.payloadSizeKB)
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

      let averagePayloadSizeKB: number | undefined;
      let maxPayloadSizeKB: number | undefined;
      if (payloadSizes.length > 0) {
        const sum = payloadSizes.reduce((acc, v) => acc + v, 0);
        averagePayloadSizeKB = Number(
          (sum / payloadSizes.length).toFixed(2),
        );
        maxPayloadSizeKB = Number(
          Math.max(...payloadSizes).toFixed(2),
        );
      }

      // Derive a human-readable error message when there are failures
      let topError: string | undefined;
      if (successCount === 0 && results.length > 0) {
        const firstProblem = results.find(
          (r) =>
            r.error ||
            (r.result && r.result.failed && r.result.failed.length > 0),
        );

        if (firstProblem) {
          if (firstProblem.error) {
            topError = firstProblem.error;
          } else if (
            firstProblem.result &&
            firstProblem.result.failed &&
            firstProblem.result.failed.length > 0
          ) {
            const f = firstProblem.result.failed[0];
            const reason = f?.response?.reason;
            if (reason) {
              topError = `APNs error: ${reason}`;
            } else if (f?.status) {
              topError = `APNs error status ${f.status}`;
            } else {
              topError = 'APNs send failed';
            }
          }
        }
      }

      return {
        success: successCount > 0,
        error: topError,
        results,
        payloadTooLargeDetected,
        retryAttempted,
        privatizedPayload,
        averagePayloadSizeKB,
        maxPayloadSizeKB,
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
