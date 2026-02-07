import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../users/users.types';
import { Bucket } from './bucket.entity';
import { ExternalNotifySystem } from './external-notify-system.entity';
import { UserAccessToken } from './user-access-token.entity';
import { UserBucket } from './user-bucket.entity';
import { UserDevice } from './user-device.entity';
import { UserIdentity } from './user-identity.entity';
import { UserSession } from './user-session.entity';
import { UserTemplate } from './user-template.entity';
import { UserWebhook } from './user-webhook.entity';

@ObjectType()
@Entity('users')
export class User {
  @Field(() => ID)
  @ApiProperty({ example: 'uuid-string' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty({ example: 'john@example.com' })
  @Column({ unique: true })
  email: string;

  @Field()
  @ApiProperty({ example: 'john_doe' })
  @Column({ unique: true })
  username: string;

  // Password field is excluded from GraphQL schema (no @Field decorator)
  @Column({ nullable: true })
  password: string;

  @Field()
  @ApiProperty({
    example: true,
    description: 'Whether the user has a password set',
  })
  @Column({ default: false })
  hasPassword: boolean;

  @Field({ nullable: true })
  @ApiProperty({ example: 'John', required: false })
  @Column({ nullable: true })
  firstName: string;

  @Field({ nullable: true })
  @ApiProperty({ example: 'Doe', required: false })
  @Column({ nullable: true })
  lastName: string;

  @Field({ nullable: true })
  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @Column({ nullable: true })
  avatar: string;

  @Field(() => UserRole)
  @ApiProperty({ enum: UserRole, default: UserRole.USER })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Field()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  resetToken: string | null;

  @Field(() => Date, { nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'timestamp', nullable: true })
  resetTokenRequestedAt: Date | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  emailConfirmationToken: string | null;

  @Field(() => Date, { nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'timestamp', nullable: true })
  emailConfirmationTokenRequestedAt: Date | null;

  @Field()
  @ApiProperty({
    example: false,
    description: 'Whether the user email is confirmed',
  })
  @Column({ default: false })
  emailConfirmed: boolean;

  @Field(() => [UserDevice], { nullable: true })
  @OneToMany(() => UserDevice, (device) => device.user, { cascade: true })
  devices: UserDevice[];

  @Field(() => [Bucket], { nullable: true })
  @OneToMany(() => Bucket, (bucket) => bucket.user, { cascade: true })
  buckets: Bucket[];

  @Field(() => [UserAccessToken], { nullable: true })
  @OneToMany(() => UserAccessToken, (accessToken) => accessToken.user, {
    cascade: true,
  })
  accessTokens: UserAccessToken[];

  @Field(() => [UserSession], { nullable: true })
  @OneToMany(() => UserSession, (session) => session.user, { cascade: true })
  sessions: UserSession[];

  @Field(() => [UserWebhook], { nullable: true })
  @OneToMany(() => UserWebhook, (webhook) => webhook.user, { cascade: true })
  webhooks: UserWebhook[];

  @Field(() => [UserBucket], { nullable: true })
  @OneToMany(() => UserBucket, (userBucket) => userBucket.user, {
    cascade: true,
  })
  userBuckets: UserBucket[];

  @Field(() => [UserIdentity], { nullable: true })
  @OneToMany(() => UserIdentity, (identity) => identity.user, { cascade: true })
  identities: UserIdentity[];

  @Field(() => [UserTemplate], { nullable: true })
  @OneToMany(() => UserTemplate, (template) => template.user, { cascade: true })
  templates: UserTemplate[];

  @Field(() => [ExternalNotifySystem], { nullable: true })
  @OneToMany(
    () => ExternalNotifySystem,
    (system) => system.user,
    { cascade: true },
  )
  externalNotifySystems: ExternalNotifySystem[];
}
