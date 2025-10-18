import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser, ParserOptions } from './builtin-parser.interface';
import {
  CreateMessageDto,
  NotificationAttachmentDto,
} from '../../messages/dto/create-message.dto';
import {
  NotificationDeliveryType,
  MediaType,
} from '../../notifications/notifications.types';
import { createHmac } from 'crypto';
import { UserSettingType } from '../../entities/user-setting.types';
import { UsersService } from '../../users/users.service';

interface ExpoWebhookPayload {
  // Common fields for both build and submit
  id: string;
  accountName: string;
  projectName: string;
  appId: string;
  platform: 'ios' | 'android';
  status: 'finished' | 'errored' | 'canceled';

  // Build-specific fields
  buildDetailsPageUrl?: string;
  parentBuildId?: string;
  initiatingUserId?: string;
  cancelingUserId?: string | null;
  artifacts?: {
    buildUrl?: string;
    logsS3KeyPrefix?: string;
  };
  metadata?: {
    appName?: string;
    username?: string;
    workflow?: string;
    appVersion?: string;
    appBuildVersion?: string;
    cliVersion?: string;
    sdkVersion?: string;
    buildProfile?: string;
    distribution?: string;
    appIdentifier?: string;
    gitCommitHash?: string;
    gitCommitMessage?: string;
    runtimeVersion?: string;
    channel?: string;
    releaseChannel?: string;
    reactNativeVersion?: string;
    trackingContext?: {
      platform: string;
      account_id: string;
      dev_client: boolean;
      project_id: string;
      tracking_id: string;
      project_type: string;
      dev_client_version: string;
    };
    credentialsSource?: string;
    isGitWorkingTreeDirty?: boolean;
    message?: string;
    runFromCI?: boolean;
  };
  metrics?: {
    memory?: number;
    buildEndTimestamp?: number;
    totalDiskReadBytes?: number;
    buildStartTimestamp?: number;
    totalDiskWriteBytes?: number;
    cpuActiveMilliseconds?: number;
    buildEnqueuedTimestamp?: number;
    totalNetworkEgressBytes?: number;
    totalNetworkIngressBytes?: number;
  };
  error?: {
    message: string;
    errorCode?: string;
  };

  // Timestamps
  createdAt: string;
  enqueuedAt?: string;
  provisioningStartedAt?: string;
  workerStartedAt?: string;
  completedAt?: string;
  updatedAt: string;
  expirationDate?: string;

  // Build-specific fields
  priority?: 'high' | 'normal' | 'low';
  resourceClass?: string;
  actualResourceClass?: string;
  maxRetryTimeMinutes?: number;

  // Submit-specific fields
  submissionDetailsPageUrl?: string;
  parentSubmissionId?: string;
  archiveUrl?: string;
  turtleBuildId?: string;
  submissionInfo?: {
    error?: {
      message: string;
      errorCode: string;
    };
    logsUrl?: string;
  };
}

@Injectable()
export class ExpoParser implements IBuiltinParser {
  constructor(private readonly usersService: UsersService) {}

  get builtInType(): PayloadMapperBuiltInType {
    return PayloadMapperBuiltInType.ZENTIK_EXPO;
  }

  get name(): string {
    return 'Expo';
  }

  get description(): string {
    return 'Parser for Expo Application Services (EAS) webhooks - handles build and submit events';
  }

  async validate(payload: any, options?: ParserOptions): Promise<boolean> {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // Verify signature if provided in headers
    const signature = options?.headers?.['expo-signature'];
    if (signature) {
      const isValidSignature = await this.verifySignature(payload, signature, options);
      if (!isValidSignature) {
        return false;
      }
    }

    // Check for required fields
    if (!payload.id || !payload.accountName || !payload.projectName || !payload.platform || !payload.status) {
      return false;
    }

    // Check if it's a valid EAS webhook (build or submit)
    const validPlatforms = ['ios', 'android'];
    const validStatuses = ['finished', 'errored', 'canceled'];

    if (!validPlatforms.includes(payload.platform) || !validStatuses.includes(payload.status)) {
      return false;
    }

    // Must have either build or submit specific fields
    const hasBuildFields = payload.buildDetailsPageUrl || payload.metadata || payload.metrics;
    const hasSubmitFields = payload.submissionDetailsPageUrl || payload.archiveUrl || payload.submissionInfo;

    if (!hasBuildFields && !hasSubmitFields) {
      return false;
    }

    return true;
  }

  async parse(payload: ExpoWebhookPayload, options?: ParserOptions): Promise<CreateMessageDto> {
    // Verify signature if provided in headers
    const signature = options?.headers?.['expo-signature'];
    if (signature) {
      const isValidSignature = await this.verifySignature(payload, signature, options);
      if (!isValidSignature) {
        throw new Error('Invalid webhook signature');
      }
    }

    const eventType = this.extractEventType(payload);
    const eventInfo = this.extractEventInfo(payload);

    return {
      title: this.getNotificationTitle(eventType, eventInfo, payload),
      subtitle: this.getNotificationSubtitle(eventType, payload),
      body: this.getNotificationBody(eventType, eventInfo, payload),
      deliveryType: this.getEventPriority(eventType, payload),
      bucketId: '', // Will be set by the service
      attachments: this.extractAttachments(payload),
    };
  }

  private extractEventType(payload: ExpoWebhookPayload): string {
    // Determine if it's a build or submit event
    const isBuildEvent = !!payload.buildDetailsPageUrl || !!payload.metadata;
    const isSubmitEvent = !!payload.submissionDetailsPageUrl || !!payload.archiveUrl;

    if (isBuildEvent) {
      return `eas_build_${payload.status}`;
    } else if (isSubmitEvent) {
      return `eas_submit_${payload.status}`;
    }

    return 'eas_unknown';
  }

  private extractEventInfo(payload: ExpoWebhookPayload): any {
    return {
      type: payload.buildDetailsPageUrl ? 'build' : 'submit',
      platform: payload.platform,
      status: payload.status,
      projectName: payload.projectName,
      accountName: payload.accountName,
      appId: payload.appId,
      buildDetailsPageUrl: payload.buildDetailsPageUrl,
      submissionDetailsPageUrl: payload.submissionDetailsPageUrl,
      metadata: payload.metadata,
      error: payload.error,
      submissionInfo: payload.submissionInfo,
    };
  }

  private getNotificationTitle(
    eventType: string,
    eventInfo: any,
    payload: ExpoWebhookPayload,
  ): string {
    const platformIcon = payload.platform === 'ios' ? '🍎' : '🤖';
    const statusIcon = this.getStatusIcon(payload.status);

    if (eventInfo.type === 'build') {
      return `${platformIcon} ${statusIcon} EAS Build ${this.capitalizeFirst(payload.status)}`;
    } else if (eventInfo.type === 'submit') {
      return `${platformIcon} ${statusIcon} EAS Submit ${this.capitalizeFirst(payload.status)}`;
    }

    return `${platformIcon} ${statusIcon} EAS ${this.capitalizeFirst(payload.status)}`;
  }

  private getNotificationSubtitle(eventType: string, payload: ExpoWebhookPayload): string {
    const eventInfo = this.extractEventInfo(payload);

    if (eventInfo.type === 'build') {
      return `Build: ${payload.projectName}`;
    } else if (eventInfo.type === 'submit') {
      return `Submit: ${payload.projectName}`;
    }

    return `EAS: ${payload.projectName}`;
  }

  private getNotificationBody(
    eventType: string,
    eventInfo: any,
    payload: ExpoWebhookPayload,
  ): string {
    let message = '';

    // Add project information
    message += `Project: ${payload.projectName}\n`;
    message += `Account: ${payload.accountName}\n`;
    message += `Platform: ${this.capitalizeFirst(payload.platform)}\n`;

    // Add build/submit specific information
    if (eventInfo.type === 'build') {
      if (payload.metadata?.appVersion) {
        message += `App Version: ${payload.metadata.appVersion}\n`;
      }
      if (payload.metadata?.appBuildVersion) {
        message += `Build Version: ${payload.metadata.appBuildVersion}\n`;
      }
      if (payload.metadata?.buildProfile) {
        message += `Profile: ${payload.metadata.buildProfile}\n`;
      }
      if (payload.metadata?.gitCommitMessage) {
        message += `Commit: ${payload.metadata.gitCommitMessage}\n`;
      }
    }

    // Add error information if present
    if (payload.error) {
      message += `\nError: ${payload.error.message}`;
      if (payload.error.errorCode) {
        message += ` (${payload.error.errorCode})`;
      }
    }

    // Add submission error if present
    if (payload.submissionInfo?.error) {
      message += `\nSubmission Error: ${payload.submissionInfo.error.message}`;
      if (payload.submissionInfo.error.errorCode) {
        message += ` (${payload.submissionInfo.error.errorCode})`;
      }
    }

    // Add timing information
    if (payload.createdAt && payload.completedAt) {
      try {
        const startTime = new Date(payload.createdAt).getTime();
        const endTime = new Date(payload.completedAt).getTime();
        const duration = Math.round((endTime - startTime) / 1000); // in seconds

        if (duration > 0) {
          message += `\nDuration: ${this.formatDuration(duration)}`;
        }
      } catch (e) {
        // Ignore date parsing errors
      }
    }

    // Add URLs
    if (eventInfo.buildDetailsPageUrl) {
      message += `\n\nBuild Details: ${eventInfo.buildDetailsPageUrl}`;
    }
    if (eventInfo.submissionDetailsPageUrl) {
      message += `\n\nSubmission Details: ${eventInfo.submissionDetailsPageUrl}`;
    }

    // Add artifacts for successful builds
    if (payload.status === 'finished' && payload.artifacts?.buildUrl) {
      message += `\n\nDownload: ${payload.artifacts.buildUrl}`;
    }

    // Add logs URL if available
    if (payload.submissionInfo?.logsUrl) {
      message += `\n\nLogs: ${payload.submissionInfo.logsUrl}`;
    }

    return message.trim();
  }

  private getEventPriority(eventType: string, payload: ExpoWebhookPayload): NotificationDeliveryType {
    switch (payload.status) {
      case 'errored':
        return NotificationDeliveryType.CRITICAL;
      case 'canceled':
        return NotificationDeliveryType.NORMAL;
      case 'finished':
        return NotificationDeliveryType.NORMAL;
      default:
        return NotificationDeliveryType.NORMAL;
    }
  }

  private extractAttachments(payload: ExpoWebhookPayload): NotificationAttachmentDto[] {
    // EAS webhooks don't typically include attachments, but we can add build artifacts if available
    const attachments: NotificationAttachmentDto[] = [];

    if (payload.status === 'finished' && payload.artifacts?.buildUrl) {
      // For Android builds, we might want to include the APK/AAB
      if (payload.platform === 'android' && payload.artifacts.buildUrl.endsWith('.apk')) {
        attachments.push({
          url: payload.artifacts.buildUrl,
          mediaType: MediaType.ICON, // Using ICON as it's not a media file but a binary
          name: `${payload.projectName} Android APK`,
          saveOnServer: false,
        });
      } else if (payload.platform === 'ios' && payload.artifacts.buildUrl.endsWith('.ipa')) {
        attachments.push({
          url: payload.artifacts.buildUrl,
          mediaType: MediaType.ICON, // Using ICON as it's not a media file but a binary
          name: `${payload.projectName} iOS IPA`,
          saveOnServer: false,
        });
      }
    }

    return attachments;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'finished':
        return '✅';
      case 'errored':
        return '❌';
      case 'canceled':
        return '⏹️';
      default:
        return '❓';
    }
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Verifica la firma HMAC-SHA1 del payload utilizzando la chiave dalle user settings
   */
  private async verifySignature(payload: any, signature: string, options?: ParserOptions): Promise<boolean> {
    if (!options?.userId) {
      return true; // Se non c'è userId, saltiamo la verifica
    }

    try {
      // Recupera la chiave ExpoKey dall'utente
      const userSettings = await this.usersService.getUserSettings(options.userId);
      const expoKeySetting = userSettings.find(setting => setting.configType === UserSettingType.ExpoKey);

      if (!expoKeySetting?.valueText) {
        return true; // Se non c'è chiave configurata, consideriamo valido (comportamento legacy)
      }

      const secret = expoKeySetting.valueText;
      const payloadString = JSON.stringify(payload);

      // Crea l'HMAC utilizzando SHA1
      const hmac = createHmac('sha1', secret);
      hmac.update(payloadString);
      const expectedSignature = `sha1=${hmac.digest('hex')}`;

      // Confronta le firme in modo sicuro (timing attack safe)
      return this.secureCompare(signature, expectedSignature);
    } catch (error) {
      console.error('[ExpoParser] Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Confronta due stringhe in modo sicuro contro timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
