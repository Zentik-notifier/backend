import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum ExternalPlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
}

/**
 * Single APNs prebuilt payload variant used for iOS passthrough.
 * This matches what the orchestrator builds when delegating to notify-external.
 */
export interface ExternalApnsPrebuiltVariantDto {
  payload: any;
  priority?: number;
  topic?: string;
}

/**
 * Multi-variant APNs payload for iOS passthrough.
 *
 * Compatibility notes:
 * - "encrypted" contains the per-device encrypted payload (preferred)
 * - "unencrypted" is used as a retry when APNs returns PayloadTooLarge
 * - "selfDownload" is a minimal payload used as last-resort fallback
 * - legacy callers may still send a single variant instead of this object
 */
export interface ExternalApnsPrebuiltMultiPayloadDto {
  encrypted?: ExternalApnsPrebuiltVariantDto;
  unencrypted?: ExternalApnsPrebuiltVariantDto;
  selfDownload?: ExternalApnsPrebuiltVariantDto;
}

/**
 * Allowed payload shapes for iOS notify-external requests.
 * Either a single variant (legacy) or a multi-variant object.
 */
export type ExternalNotifyRequestIosPayload =
  | ExternalApnsPrebuiltVariantDto
  | ExternalApnsPrebuiltMultiPayloadDto;

/**
 * Delivery strategies used by the iOS APNs flow.
 *
 * This enum backs the `sentWith` and `availableMethods` fields exposed
 * by the notify-external endpoint and is also used internally in the
 * orchestrator to reason about which strategy has been used.
 */
export enum IosDeliveryStrategy {
  ENCRYPTED = 'ENCRYPTED',
  UNENCRYPTED = 'UNENCRYPTED',
  SELF_DOWNLOAD = 'SELF_DOWNLOAD',
}

export class ExternalDeviceDataIosDto {
  @ApiProperty({ description: 'APNs device token', example: '1a2b3c4d...' })
  @IsString()
  token!: string;
}

export class ExternalDeviceDataFcmDto {
  @ApiProperty({ description: 'FCM device token', example: 'fcm_XXXXX' })
  @IsString()
  token!: string;
}

export class ExternalDeviceDataWebDto {
  @ApiProperty({
    description: 'Web Push endpoint',
    example: 'https://fcm.googleapis.com/fcm/send/...',
  })
  @IsString()
  endpoint!: string;

  @ApiProperty({ description: 'Web Push p256dh key', example: 'BAbc...' })
  @IsString()
  p256dh!: string;

  @ApiProperty({ description: 'Web Push auth secret', example: 'abc123...' })
  @IsString()
  auth!: string;

  @ApiProperty({
    description: 'VAPID public key for device',
    example: 'BPub...',
  })
  @IsString()
  publicKey!: string;

  @ApiProperty({
    description: 'VAPID private key for device',
    example: 'Priv...',
  })
  @IsString()
  privateKey!: string;
}

export class ExternalNotifyRequestDto {
  @ApiProperty({ enum: ExternalPlatform })
  @IsEnum(ExternalPlatform)
  platform!: ExternalPlatform;

  @ApiProperty({
    description: 'Prebuilt payload to be sent as-is',
    type: Object,
    examples: {
      IOS: {
        // Multi-variant APNs payload used by iOS passthrough
        encrypted: {
          payload: {
            aps: { alert: { title: 'Encrypted Notification' } },
            e: '...encrypted blob...'
          },
          priority: 10,
          topic: 'com.example.app',
        },
        unencrypted: {
          payload: {
            aps: { alert: { title: 'Hello' } },
            tit: 'Hello',
            bdy: 'World',
          },
          priority: 10,
          topic: 'com.example.app',
        },
        selfDownload: {
          payload: {
            aps: { 'content-available': 1 },
            selfDownload: true,
          },
          priority: 5,
          topic: 'com.example.app',
        },
      },
      ANDROID: {
        apns: {
          payload: {
            /* ... */
          },
        },
        data: {
          /* ... */
        },
      },
      WEB: {
        title: '...',
        body: '...',
        url: '/',
        notificationId: '...',
        actions: [{ action: 'OPEN', title: 'Open' }],
      },
    },
  })
  @IsObject()
  payload!: any;

  @ApiProperty({
    description: 'Device data per platform',
    oneOf: [
      { $ref: '#/components/schemas/ExternalDeviceDataIosDto' },
      { $ref: '#/components/schemas/ExternalDeviceDataFcmDto' },
      { $ref: '#/components/schemas/ExternalDeviceDataWebDto' },
    ],
  })
  @IsObject()
  deviceData!:
    | ExternalDeviceDataIosDto
    | ExternalDeviceDataFcmDto
    | ExternalDeviceDataWebDto;

  @ApiProperty({
    required: false,
    description:
      'If true, the originating server allows retry without encryption when APNs returns PayloadTooLarge (mirrors UnencryptOnBigPayload setting).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  retryWithoutEncEnabled?: boolean;
}

/**
 * Base shape for notify-external responses across all platforms.
 */
export interface ExternalNotifyResponseBaseDto {
  success: boolean;
  message?: string;
  platform: ExternalPlatform;
  sentAt: string;
  payloadSizeInKb?: number;
}

/**
 * iOS-specific notify-external response, enriched with delivery metadata.
 */
export interface ExternalNotifyResponseIosDto extends ExternalNotifyResponseBaseDto {
  platform: ExternalPlatform.IOS;
  sentWith?: IosDeliveryStrategy;
  availableMethods?: IosDeliveryStrategy[];
}

/**
 * Discriminated union of all notify-external responses.
 *
 * For non-iOS platforms we currently only return the base fields.
 */
export type ExternalNotifyResponseDto =
  | ExternalNotifyResponseIosDto
  | ExternalNotifyResponseBaseDto;

/**
 * Narrowed view of ExternalNotifyRequestDto for iOS requests.
 *
 * This is used server-side to give strong typing to the iOS
 * passthrough flow (notify-external → sendPrebuilt).
 */
export type ExternalNotifyRequestIosDto = ExternalNotifyRequestDto & {
  platform: ExternalPlatform.IOS;
  deviceData: ExternalDeviceDataIosDto;
  payload: ExternalNotifyRequestIosPayload;
};
