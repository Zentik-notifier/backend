import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { OAuthProviderType } from './oauth-provider.entity';

@ObjectType()
@Entity('user_sessions')
export class UserSession {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Session ID' })
  id: string;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @ApiProperty({ type: () => User, description: 'User who owns this session' })
  user: User;

  @Field()
  @Column('uuid')
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @Field()
  @Column({ length: 255 })
  @ApiProperty({ description: 'JWT token ID (jti claim)' })
  tokenId: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  @ApiProperty({ description: 'Device name or description' })
  deviceName?: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  @ApiProperty({ description: 'Operating system' })
  operatingSystem?: string;

  @Field({ nullable: true })
  @Column({ length: 100, nullable: true })
  @ApiProperty({ description: 'Browser name and version' })
  browser?: string;

  @Field({ nullable: true })
  @Column({ length: 45, nullable: true })
  @ApiProperty({ description: 'IP address' })
  ipAddress?: string;

  @Field({ nullable: true })
  @Column({ length: 500, nullable: true })
  @ApiProperty({ description: 'User agent string' })
  userAgent?: string;

  @Field(() => OAuthProviderType, { nullable: true })
  @Column({ type: 'enum', enum: OAuthProviderType, enumName: 'oauth_provider_type_enum', nullable: true })
  @ApiProperty({ description: 'OAuth provider used for login (enum)' })
  loginProvider?: OAuthProviderType | null;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'Last activity timestamp' })
  lastActivity?: Date;

  @Field()
  @Column({ type: 'timestamp' })
  @ApiProperty({ description: 'Token expiration time' })
  expiresAt: Date;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  @ApiProperty({ description: 'Short-lived OAuth exchange code' })
  exchangeCode?: string | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'When the exchange code was generated' })
  exchangeCodeRequestedAt?: Date | null;

  @Field()
  @Column({ default: true })
  @ApiProperty({ description: 'Whether the session is active' })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
