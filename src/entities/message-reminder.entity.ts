import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
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

@ObjectType()
@Entity('message_reminders')
export class MessageReminder {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @ApiProperty()
  @Column()
  messageId: string;

  @Field(() => Message)
  @ApiProperty({ type: () => Message })
  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Field(() => ID)
  @ApiProperty()
  @Column()
  userId: string;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field(() => Int)
  @ApiProperty({ description: 'Interval in minutes between reminders' })
  @Column({ type: 'int' })
  remindEveryMinutes: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Maximum number of reminders to send' })
  @Column({ type: 'int', default: 5 })
  maxReminders: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Current count of reminders sent' })
  @Column({ type: 'int', default: 0 })
  remindersSent: number;

  @Field()
  @ApiProperty({ description: 'When to send the next reminder' })
  @Column({ type: 'timestamp with time zone' })
  nextReminderAt: Date;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
