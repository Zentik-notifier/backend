import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Bucket } from './bucket.entity';
import { User } from './user.entity';

@ObjectType()
export class SnoozeSchedule {
  @Field(() => [String])
  @ApiProperty({ description: 'Days of the week when snooze is active' })
  days: string[];

  @Field()
  @ApiProperty({ description: 'Start time for snooze period' })
  timeFrom: string;

  @Field()
  @ApiProperty({ description: 'End time for snooze period' })
  timeTill: string;

  @Field()
  @ApiProperty({ description: 'Whether this snooze schedule is enabled' })
  isEnabled: boolean;
}

@ObjectType()
@Entity('user_buckets')
export class UserBucket {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field()
  @ApiProperty()
  @Column()
  userId: string;

  @Field(() => Bucket)
  @ApiProperty({ type: () => Bucket })
  @ManyToOne(() => Bucket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bucketId' })
  bucket: Bucket;

  @Field()
  @ApiProperty()
  @Column()
  bucketId: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Magic code for unauthenticated message creation',
  })
  @Column({ type: 'varchar', nullable: true, unique: true })
  magicCode?: string | null;

  @Field(() => Date, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Date until which notifications from this bucket are snoozed',
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  snoozeUntil?: Date | null;

  @Field(() => [SnoozeSchedule], { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Array of snooze schedules for recurring snooze periods',
    type: () => [SnoozeSchedule],
  })
  @Column({ type: 'jsonb', nullable: true, default: '[]' })
  snoozes?: SnoozeSchedule[];

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
