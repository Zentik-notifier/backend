import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DevicePlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
}

registerEnumType(DevicePlatform, {
  name: 'DevicePlatform',
  description: 'Platform types for devices',
});

@InputType('WebPushSubscriptionFieldsInput')
export class WebPushSubscriptionFieldsInput {
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  endpoint?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  p256dh?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  auth?: string;
}

@InputType()
export class RegisterDeviceDto {
  @Field({ nullable: true })
  @ApiProperty({
    description: 'Device ID for updating existing device',
    example: 'uuid-string',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'Device token for push notifications',
    example: 'a1b2...',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceToken?: string;

  @Field(() => DevicePlatform)
  @ApiProperty({
    description: 'Platform of the device',
    enum: DevicePlatform,
    example: DevicePlatform.IOS,
  })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'Device name or identifier',
    example: "John's iPhone",
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'Device model',
    example: 'iPhone 15 Pro',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'OS version',
    example: '17.0.1',
    required: false,
  })
  @IsOptional()
  @IsString()
  osVersion?: string;

  // Web Push subscription fields (JSON) optional
  @Field(() => WebPushSubscriptionFieldsInput, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Web Push subscription JSON (endpoint, p256dh, auth)',
  })
  @IsOptional()
  subscriptionFields?: WebPushSubscriptionFieldsInput;

  @Field({ nullable: true, description: 'Optional JSON-serialized metadata for the device (app versions, build info, etc.)' })
  @ApiProperty({
    required: false,
    description: 'Optional JSON-serialized metadata for the device (app versions, build info, etc.)',
    example: '{"appVersion":"0.1.159","backendVersion":"0.1.153","dockerVersion":null,"nativeVersion":"1.6.28"}',
  })
  @IsOptional()
  @IsString()
  metadata?: string;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'Whether this device should only receive local notifications',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  onlyLocal?: boolean;

  @Field({ nullable: true })
  @ApiProperty({
    description:
      'Public key for device-level encryption (iOS devices should provide this)',
    example: '-----BEGIN PUBLIC KEY-----...',
    required: false,
  })
  @IsOptional()
  @IsString()
  publicKey?: string;
}
