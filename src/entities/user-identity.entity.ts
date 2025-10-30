import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { OAuthProviderType } from './oauth-provider.entity';

@ObjectType()
@Entity('user_identities')
@Unique(['userId', 'providerType'])
export class UserIdentity {
  @Field(() => ID)
  @ApiProperty({ example: 'uuid-string' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ example: 'octocat@example.com', required: false })
  @Column({ type: 'text', nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({
    example: 'https://avatars.githubusercontent.com/u/1',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  avatarUrl?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, description: 'Serialized provider metadata (JSON string)' })
  @Column({ type: 'text', nullable: true })
  metadata?: string | null;

  @Field(() => OAuthProviderType, { nullable: true })
  @ApiProperty({ enum: OAuthProviderType, required: false })
  @Column({ type: 'enum', enum: OAuthProviderType, enumName: 'oauth_provider_type_enum', nullable: true })
  providerType?: OAuthProviderType | null;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field()
  @ApiProperty({ example: 'uuid-string' })
  @Column({ type: 'uuid' })
  userId: string;

  @Field()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}
