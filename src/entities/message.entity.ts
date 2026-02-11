import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from '../notifications/notifications.types';
import { GraphQLJSON } from '../common/types/json.type';
import { Attachment } from './attachment.entity';
import { Bucket } from './bucket.entity';

// Register GraphQL Enums (exposed via Message)
registerEnumType(NotificationDeliveryType, {
  name: 'NotificationDeliveryType',
});

registerEnumType(NotificationActionType, {
  name: 'NotificationActionType',
});

registerEnumType(MediaType, {
  name: 'MediaType',
});

@ObjectType()
export class MessageAttachment {
  @Field(() => MediaType)
  @ApiProperty({
    enum: MediaType,
    enumName: 'MediaType',
  })
  mediaType: MediaType;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  mime?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  url?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  name?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  attachmentUuid?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  saveOnServer?: boolean;
}

@ObjectType()
export class NotificationAction {
  @Field(() => NotificationActionType)
  @ApiProperty({
    enum: NotificationActionType,
    enumName: 'NotificationActionType',
  })
  type: NotificationActionType;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  value?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  destructive?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  icon?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  title?: string;
}

@ObjectType()
@Entity('messages')
export class Message {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty()
  @Column()
  title: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  subtitle?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  body?: string;

  @Field(() => [MessageAttachment], { nullable: true })
  @ApiProperty({ type: [Object], required: false })
  @Column({ type: 'json', nullable: true })
  attachments?: MessageAttachment[];

  @Field(() => [Attachment], { nullable: true })
  @ApiProperty({ type: [Object], required: false })
  @OneToMany(() => Attachment, (attachment) => attachment.messageId)
  fileAttachments?: Attachment[];

  @Field(() => [String], { nullable: true })
  @ApiProperty({
    type: [String],
    required: false,
    description: 'List of attachment UUIDs for this message',
  })
  @Column({ type: 'text', array: true, nullable: true })
  attachmentUuids?: string[];

  @Field(() => [NotificationAction], { nullable: true })
  @ApiProperty({ type: [Object], required: false })
  @Column({ type: 'json', nullable: true })
  actions?: NotificationAction[];

  @Field(() => NotificationAction, { nullable: true })
  @ApiProperty({ type: Object, required: false })
  @Column({ type: 'json', nullable: true })
  tapAction?: NotificationAction;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  sound?: string;

  @Field(() => NotificationDeliveryType)
  @ApiProperty({ enum: NotificationDeliveryType })
  @Column({
    type: 'enum',
    enum: NotificationDeliveryType,
    default: NotificationDeliveryType.NORMAL,
  })
  deliveryType: NotificationDeliveryType;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  addMarkAsReadAction?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  addOpenNotificationAction?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  addDeleteAction?: boolean;

  @Field(() => [Number], { nullable: true })
  @ApiProperty({ type: [Number], required: false })
  @Column({ type: 'int', array: true, nullable: true })
  snoozes?: number[];

  @Field(() => [Number], { nullable: true })
  @ApiProperty({ type: [Number], required: false })
  @Column({ type: 'int', array: true, nullable: true })
  postpones?: number[];

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  locale?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'If set, the message will be resent every N minutes until acknowledged',
  })
  @Column({ type: 'int', nullable: true })
  remindEveryMinutes?: number;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Maximum number of reminders to send (default: 5)',
    default: 5,
  })
  @Column({ type: 'int', nullable: true, default: 5 })
  maxReminders?: number;

  @Field(() => Bucket)
  @ApiProperty({ type: () => Bucket })
  @ManyToOne(() => Bucket, (bucket) => bucket.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bucketId' })
  bucket: Bucket;

  @Field()
  @ApiProperty()
  @Column()
  bucketId: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'Optional group ID for notification grouping, falls back to bucketId if not provided',
  })
  @Column({ nullable: true })
  groupId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'Optional collapse ID for APNS collapse-id, used to replace notifications with the same collapse ID',
  })
  @Column({ nullable: true })
  collapseId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'ID of the entity execution that generated this message',
  })
  @Column({ nullable: true })
  executionId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'When true, message is deleted automatically after 1 hour by cleanup',
  })
  @Column({ type: 'boolean', nullable: true, default: false })
  ephemeral?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Data from external notify system responses (e.g. NTFY message id)',
  })
  @Column({ type: 'json', nullable: true })
  externalSystemResponse?: Record<string, unknown>;

  @Field(() => Date, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'When set, message is sent at this time by the scheduler instead of immediately',
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  scheduledSendAt?: Date | null;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
