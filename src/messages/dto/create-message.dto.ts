import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { transformMultipartBoolean } from '../../common/utils/transformers';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from '../../notifications/notifications.types';

@InputType()
export class NotificationAttachmentDto {
  @Field(() => MediaType)
  @ApiProperty({ enum: MediaType, enumName: 'MediaType' })
  @IsEnum(MediaType)
  mediaType: MediaType;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf((o) => !o.attachmentUuid)
  @IsString()
  url?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf((o) => !o.url)
  @IsString()
  attachmentUuid?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Save attachment to server when URL is provided',
  })
  @IsOptional()
  @IsBoolean()
  saveOnServer?: boolean;
}

@InputType()
export class NotificationActionDto {
  @Field(() => NotificationActionType)
  @ApiProperty({
    enum: NotificationActionType,
    enumName: 'NotificationActionType',
  })
  @IsEnum(NotificationActionType)
  type: NotificationActionType;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  value?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  destructive?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;
}

@InputType()
export class CreateMessageDto {
  @Field()
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  title: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subtitle?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;

  @Field(() => [NotificationAttachmentDto], { nullable: true })
  @ApiProperty({ type: [NotificationAttachmentDto], required: false })
  @IsOptional()
  @Transform(
    ({ value }) => {
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (_) {
          return value;
        }
      }
      if (Array.isArray(value)) {
        return value.map((item) =>
          plainToInstance(NotificationAttachmentDto, item),
        );
      }
      return value;
    },
    { toClassOnly: true },
  )
  @Type(() => NotificationAttachmentDto)
  @IsArray()
  @ValidateNested({ each: true })
  attachments?: NotificationAttachmentDto[];

  @Field(() => [String], { nullable: true })
  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUuids?: string[];

  @Field(() => [NotificationActionDto], { nullable: true })
  @ApiProperty({ type: [NotificationActionDto], required: false })
  @IsOptional()
  @Transform(
    ({ value }) => {
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (_) {
          return value;
        }
      }
      if (Array.isArray(value)) {
        return value.map((item) =>
          plainToInstance(NotificationActionDto, item),
        );
      }
      return value;
    },
    { toClassOnly: true },
  )
  @Type(() => NotificationActionDto)
  @IsArray()
  @ValidateNested({ each: true })
  actions?: NotificationActionDto[];

  @Field(() => NotificationActionDto, { nullable: true })
  @ApiProperty({ type: NotificationActionDto, required: false })
  @IsOptional()
  @Transform(
    ({ value }) => {
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (_) {
          return value;
        }
      }
      if (value && typeof value === 'object') {
        return plainToInstance(NotificationActionDto, value);
      }
      return value;
    },
    { toClassOnly: true },
  )
  @Type(() => NotificationActionDto)
  @ValidateNested()
  tapAction?: NotificationActionDto;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sound?: string;

  @Field(() => NotificationDeliveryType)
  @ApiProperty({ enum: NotificationDeliveryType })
  @IsEnum(NotificationDeliveryType)
  deliveryType: NotificationDeliveryType;

  @Field({ nullable: true })
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @Transform(transformMultipartBoolean, { toClassOnly: true })
  @IsBoolean()
  addMarkAsReadAction?: boolean = true;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(transformMultipartBoolean, { toClassOnly: true })
  @IsBoolean()
  addOpenNotificationAction?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @Transform(transformMultipartBoolean, { toClassOnly: true })
  @IsBoolean()
  addDeleteAction?: boolean = true;

  @Field(() => [Number], { nullable: true })
  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map(Number) : value,
  )
  @IsArray()
  snoozes?: number[];

  @Field(() => [Number], { nullable: true })
  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map(Number) : value,
  )
  @IsArray()
  postpones?: number[];

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  locale?: string;

  @Field({ nullable: true })
  @ApiProperty({
    description:
      'Bucket ID or name. If a name is provided, the system will find the corresponding bucket by name.',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => !o.magicCode)
  @IsString()
  bucketId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    description:
      'Magic code for unauthenticated message creation. Alternative to bucketId + authentication.',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => !o.bucketId)
  @IsString()
  magicCode?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'Optional group ID for notification grouping, falls back to bucketId if not provided',
  })
  @IsOptional()
  @IsString()
  groupId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'Optional collapse ID for APNS collapse-id, used to replace notifications with the same collapse ID',
  })
  @IsOptional()
  @IsString()
  collapseId?: string;

  @Field(() => [String], { nullable: true })
  @ApiProperty({
    type: [String],
    required: false,
    description:
      'Optional array of user IDs or usernames to filter notifications to specific users only. If usernames are provided, the system will find the corresponding users by username.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
    return value || [];
  })
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'Optional image URL. If provided, will automatically create an image attachment.',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'Optional video URL. If provided, will automatically create a video attachment.',
  })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'Optional GIF URL. If provided, will automatically create a GIF attachment.',
  })
  @IsOptional()
  @IsString()
  gifUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'Optional tap URL. If provided, will automatically set the tapAction to NAVIGATE with this URL.',
  })
  @IsOptional()
  @IsString()
  tapUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'If set, the message will be resent every N minutes until acknowledged',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  remindEveryMinutes?: number;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Maximum number of reminders to send (default: 5)',
    default: 5,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 5))
  maxReminders?: number;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'ID of the entity execution that generated this message',
  })
  @IsOptional()
  @IsString()
  executionId?: string;
}
