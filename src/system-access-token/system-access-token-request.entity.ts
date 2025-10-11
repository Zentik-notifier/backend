import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
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
import { SystemAccessToken } from './system-access-token.entity';

export enum SystemAccessTokenRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DECLINED = 'declined',
}

registerEnumType(SystemAccessTokenRequestStatus, {
  name: 'SystemAccessTokenRequestStatus',
  description: 'Status of a system access token request',
});

@Entity('system_access_token_requests')
@ObjectType()
export class SystemAccessTokenRequest {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Field()
  id: string;

  @Column({ name: 'userId' })
  @ApiProperty()
  @Field()
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  @Field(() => User)
  user: User;

  @Column({ name: 'systemAccessTokenId', nullable: true })
  @ApiProperty({ required: false })
  @Field({ nullable: true })
  systemAccessTokenId?: string;

  @ManyToOne(() => SystemAccessToken, { nullable: true, eager: true })
  @JoinColumn({ name: 'systemAccessTokenId' })
  @Field(() => SystemAccessToken, { nullable: true })
  systemAccessToken?: SystemAccessToken;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ required: false })
  @Field({ nullable: true })
  plainTextToken?: string;

  @Column({ type: 'int' })
  @ApiProperty()
  @Field()
  maxRequests: number;

  @Column({
    type: 'enum',
    enum: SystemAccessTokenRequestStatus,
    default: SystemAccessTokenRequestStatus.PENDING,
  })
  @ApiProperty({ enum: SystemAccessTokenRequestStatus })
  @Field(() => SystemAccessTokenRequestStatus)
  status: SystemAccessTokenRequestStatus;

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
}
