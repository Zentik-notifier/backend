import { Field, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../entities/user.entity';

@Entity('system_access_tokens')
@ObjectType()
export class SystemAccessToken {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Field()
  id: string;

  @Column()
  @ApiProperty()
  @Field()
  tokenHash: string;

  @Column({ type: 'int', default: 0 })
  @ApiProperty()
  @Field()
  maxCalls: number;

  @Column({ type: 'int', default: 0 })
  @ApiProperty()
  @Field()
  calls: number;

  @Column({ type: 'int', default: 0 })
  @ApiProperty({ description: 'Total number of calls ever made by this token' })
  @Field()
  totalCalls: number;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ required: false, description: 'Plain text token (sat_...) saved for display/ops' })
  @Field({ nullable: true })
  token?: string;

  @Column({ nullable: true })
  @ApiProperty({ required: false })
  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @Column({ name: 'requesterId', nullable: true })
  @ApiProperty({ required: false })
  @Field({ nullable: true })
  requesterId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requesterId' })
  @Field(() => User, { nullable: true })
  requester?: User;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ required: false })
  @Field({ nullable: true })
  description?: string;

  @CreateDateColumn()
  @ApiProperty()
  @Field()
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty()
  @Field()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiProperty({ required: false, description: 'Last time the monthly calls counter was reset' })
  @Field({ nullable: true })
  lastResetAt?: Date;

  @Column({ type: 'text', array: true, default: '{}' })
  @ApiProperty({ type: [String], required: false })
  @Field(() => [String], { nullable: true })
  scopes?: string[];

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ required: false, description: 'Stable identifier of the requesting server (IP, hostname or fingerprint)'} )
  @Field({ nullable: true })
  requesterIdentifier?: string;
}
