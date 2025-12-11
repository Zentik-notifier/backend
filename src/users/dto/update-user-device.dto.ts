import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { WebPushSubscriptionFieldsInput } from './register-device.dto';

@InputType('UpdateUserDeviceInput')
export class UpdateUserDeviceDto {
  @Field()
  @ApiProperty()
  @IsUUID()
  deviceId: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceToken?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @Field(() => WebPushSubscriptionFieldsInput, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  subscriptionFields?: WebPushSubscriptionFieldsInput;

  @Field({ nullable: true, description: 'Optional JSON-serialized metadata for the device (app versions, build info, etc.)' })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  metadata?: string;
}
