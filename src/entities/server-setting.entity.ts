import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ServerSettingType {
  // JWT
  JwtAccessTokenExpiration = 'JwtAccessTokenExpiration',
  JwtRefreshTokenExpiration = 'JwtRefreshTokenExpiration',
  
  // APN Push
  ApnPush = 'ApnPush',
  ApnKeyId = 'ApnKeyId',
  ApnTeamId = 'ApnTeamId',
  ApnPrivateKeyPath = 'ApnPrivateKeyPath',
  ApnBundleId = 'ApnBundleId',
  ApnProduction = 'ApnProduction',
  
  // Firebase Push
  FirebasePush = 'FirebasePush',
  FirebaseProjectId = 'FirebaseProjectId',
  FirebasePrivateKey = 'FirebasePrivateKey',
  FirebaseClientEmail = 'FirebaseClientEmail',
  
  // Web Push
  WebPush = 'WebPush',
  VapidSubject = 'VapidSubject',
  
  // Backend
  PublicBackendUrl = 'PublicBackendUrl',
  
  // Push Passthrough
  PushNotificationsPassthroughServer = 'PushNotificationsPassthroughServer',
  PushPassthroughToken = 'PushPassthroughToken',
  
  // Attachments
  AttachmentsEnabled = 'AttachmentsEnabled',
  AttachmentsStoragePath = 'AttachmentsStoragePath',
  AttachmentsMaxFileSize = 'AttachmentsMaxFileSize',
  AttachmentsAllowedMimeTypes = 'AttachmentsAllowedMimeTypes',
  AttachmentsDeleteJobEnabled = 'AttachmentsDeleteJobEnabled',
  AttachmentsDeleteCronJob = 'AttachmentsDeleteCronJob',
  AttachmentsMaxAge = 'AttachmentsMaxAge',
  
  // Backup
  BackupEnabled = 'BackupEnabled',
  BackupExecuteOnStart = 'BackupExecuteOnStart',
  BackupStoragePath = 'BackupStoragePath',
  BackupMaxToKeep = 'BackupMaxToKeep',
  BackupCronJob = 'BackupCronJob',
  
  // Messages
  MessagesMaxAge = 'MessagesMaxAge',
  MessagesDeleteJobEnabled = 'MessagesDeleteJobEnabled',
  MessagesDeleteCronJob = 'MessagesDeleteCronJob',
  
  // Email
  EmailEnabled = 'EmailEnabled',
  EmailType = 'EmailType',
  EmailHost = 'EmailHost',
  EmailPort = 'EmailPort',
  EmailSecure = 'EmailSecure',
  EmailUser = 'EmailUser',
  EmailPass = 'EmailPass',
  EmailFrom = 'EmailFrom',
  EmailFromName = 'EmailFromName',
  ResendApiKey = 'ResendApiKey',
  
  // Rate Limiting
  RateLimitTrustProxy = 'RateLimitTrustProxy',
  RateLimitForwardHeader = 'RateLimitForwardHeader',
  RateLimitTtlMs = 'RateLimitTtlMs',
  RateLimitLimit = 'RateLimitLimit',
  RateLimitBlockMs = 'RateLimitBlockMs',
  RateLimitMessagesRps = 'RateLimitMessagesRps',
  RateLimitMessagesTtlMs = 'RateLimitMessagesTtlMs',
}

registerEnumType(ServerSettingType, { name: 'ServerSettingType' });

@ObjectType()
@Entity('server_settings')
export class ServerSetting {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ServerSettingType)
  @ApiProperty({ enum: ServerSettingType })
  @Column({
    type: 'enum',
    enum: ServerSettingType,
    enumName: 'server_setting_type_enum',
    unique: true,
  })
  configType: ServerSettingType;

  @Field(() => String, {
    nullable: true,
    description: 'String value for the setting, when applicable',
  })
  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  valueText?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Boolean value for the setting, when applicable',
  })
  @ApiProperty({ required: false })
  @Column({ type: 'boolean', nullable: true })
  valueBool?: boolean | null;

  @Field(() => Number, {
    nullable: true,
    description: 'Numeric value for the setting, when applicable',
  })
  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true })
  valueNumber?: number | null;

  @Field(() => [String], {
    nullable: true,
    description: 'Possible values for the setting (for enum-like settings)',
  })
  @ApiProperty({ required: false, type: [String] })
  @Column({ type: 'simple-array', nullable: true })
  possibleValues?: string[] | null;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
