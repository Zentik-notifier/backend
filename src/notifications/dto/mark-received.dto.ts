import { ApiProperty } from '@nestjs/swagger';

export class MarkReceivedDto {
  @ApiProperty({
    description: 'User device ID that received the notification',
    example: 'dvc_12345',
  })
  userDeviceId!: string;
}

export class DeviceReportReceivedDto {
  @ApiProperty({
    description: 'Device push token',
    example: 'fcm_or_apns_token_string',
  })
  deviceToken!: string;
}

export class UpdateReceivedUpToDto {
  @ApiProperty({
    description: 'Notification ID used as upper bound',
    example: 'ntf_12345',
  })
  id!: string;

  @ApiProperty({
    description: 'Device push token used to resolve the user device',
    example: 'fcm_or_apns_token_string',
  })
  deviceToken!: string;
}

export class ExternalNotifyRequestDocDto {
  @ApiProperty({
    description: 'Notification payload as JSON string',
    example: '{"title":"Hello","body":"World"}',
  })
  notification!: string;

  @ApiProperty({
    description: 'User device object as JSON string',
    example: '{"deviceToken":"abc","platform":"WEB"}',
  })
  userDevice!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'APNs headers override as JSON string',
    example: '{"apns-push-type":"alert"}',
  })
  apnsHeaders?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'FCM options as JSON string',
    example: '{"priority":"high"}',
  })
  fcmOptions?: string;
}

export class NotificationServicesInfoDto {
  @ApiProperty({ example: 'IOS', description: 'Device platform' })
  devicePlatform!: string;
  @ApiProperty({ example: 'PUSH', description: 'Service type (PUSH or LOCAL)' })
  service!: string;
}
