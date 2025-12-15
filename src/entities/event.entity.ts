import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from '../common/types/json.type';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EventType {
  LOGIN = 'LOGIN',
  LOGIN_OAUTH = 'LOGIN_OAUTH',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  PUSH_PASSTHROUGH = 'PUSH_PASSTHROUGH',
  PUSH_PASSTHROUGH_FAILED = 'PUSH_PASSTHROUGH_FAILED',
  MESSAGE = 'MESSAGE',
  NOTIFICATION = 'NOTIFICATION',
  NOTIFICATION_ACK = 'NOTIFICATION_ACK',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
  BUCKET_CREATION = 'BUCKET_CREATION',
  BUCKET_SHARING = 'BUCKET_SHARING',
  BUCKET_UNSHARING = 'BUCKET_UNSHARING',
  BUCKET_DELETION = 'BUCKET_DELETION',
  DEVICE_REGISTER = 'DEVICE_REGISTER',
  DEVICE_UNREGISTER = 'DEVICE_UNREGISTER',
  ACCOUNT_DELETE = 'ACCOUNT_DELETE',
  SYSTEM_TOKEN_REQUEST_CREATED = 'SYSTEM_TOKEN_REQUEST_CREATED',
  SYSTEM_TOKEN_REQUEST_APPROVED = 'SYSTEM_TOKEN_REQUEST_APPROVED',
  SYSTEM_TOKEN_REQUEST_DECLINED = 'SYSTEM_TOKEN_REQUEST_DECLINED',
  USER_FEEDBACK = 'USER_FEEDBACK',
  EMAIL_SENT = 'EMAIL_SENT',
  EMAIL_FAILED = 'EMAIL_FAILED',
}

registerEnumType(EventType, {
  name: 'EventType',
  description: 'Tracked event type',
});

@ObjectType()
@Entity('events')
export class Event {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => EventType)
  @Column({
    type: 'enum',
    enum: EventType,
    nullable: false,
  })
  type: EventType;

  @Field({ nullable: true })
  @Column({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  objectId?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  targetId?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  additionalInfo?: Record<string, any>;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
