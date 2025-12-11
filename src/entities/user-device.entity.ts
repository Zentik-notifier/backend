import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DevicePlatform } from '../users/dto';
import { User } from './user.entity';

@ObjectType('WebPushSubscriptionFields')
export class WebPushSubscriptionFields {
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

@ObjectType()
@Entity('user_devices')
export class UserDevice {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty()
  @Column()
  userId: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceToken?: string | null;

  @Field()
  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  @Column({
    type: 'enum',
    enum: DevicePlatform,
    enumName: 'device_platform_enum',
  })
  platform: DevicePlatform;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  deviceName: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  deviceModel: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  osVersion: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Public key for device-level encryption',
  })
  @Column({ type: 'text', nullable: true })
  publicKey?: string | null;

  // Private key for device-level decryption - only exposed to the device owner
  @Field(() => String, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Private key for device-level decryption',
  })
  @Column({ type: 'text', nullable: true })
  privateKey?: string | null;

  // Web Push specific fields (JSON)
  @Field(() => WebPushSubscriptionFields, { nullable: true })
  @ApiProperty({ required: false, description: 'Web Push subscription fields' })
  @Column({ nullable: true, type: 'jsonb' })
  subscriptionFields?: WebPushSubscriptionFields | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Optional JSON-serialized metadata for the device (app versions, build info, etc.)',
  })
  @ApiProperty({ required: false, description: 'Serialized metadata JSON for this device' })
  @Column({ type: 'text', nullable: true })
  metadata?: string | null;

  @Field()
  @ApiProperty({
    description: 'Whether this device should only receive local notifications',
  })
  @Column({ default: false })
  onlyLocal: boolean;

  @Field()
  @ApiProperty()
  @Column()
  lastUsed: Date;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
