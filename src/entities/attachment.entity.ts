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
import { MediaType } from '../notifications/notifications.types';
import { Message } from './message.entity';
import { User } from './user.entity';

@ObjectType()
@Entity('attachments')
export class Attachment {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty()
  @Column()
  filename: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  originalFilename?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'bigint', nullable: true })
  size?: number;

  @Field()
  @ApiProperty()
  @Column()
  filepath: string;

  @Field(() => MediaType, { nullable: true })
  @ApiProperty({ enum: MediaType, required: false })
  @Column({
    type: 'enum',
    enum: MediaType,
    nullable: true,
  })
  mediaType?: MediaType;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  messageId?: string;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field()
  @ApiProperty()
  @Column()
  userId: string;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
