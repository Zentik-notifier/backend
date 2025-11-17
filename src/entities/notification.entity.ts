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
import { Message } from './message.entity';
import { User } from './user.entity';
import { UserDevice } from './user-device.entity';

@ObjectType()
@Entity('notifications')
export class Notification {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Foreign key column - not exposed to GraphQL
  @Column()
  messageId: string;

  @Field(() => Message)
  @ApiProperty({ type: () => Message })
  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  receivedAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  readAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  error?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  sentAt?: Date;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @Field()
  @ApiProperty()
  @Column()
  userId: string;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  userDeviceId?: string;

  @Field(() => UserDevice, { nullable: true })
  @ApiProperty({ type: () => UserDevice, required: false })
  @ManyToOne(() => UserDevice, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userDeviceId' })
  userDevice?: UserDevice;
}
