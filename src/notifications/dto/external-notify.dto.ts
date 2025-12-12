import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum ExternalPlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
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
        rawPayload: {
          aps: { alert: { title: 'Encrypted Notification' } },
          enc: '...',
        },
        customPayload: { priority: 10 },
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
