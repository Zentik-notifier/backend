import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

// OAuth Provider Type Enum
export enum OAuthProviderType {
  GITHUB = 'GITHUB',
  GOOGLE = 'GOOGLE',
  CUSTOM = 'CUSTOM',
}

// GraphQL registrations
registerEnumType(OAuthProviderType, {
  name: 'OAuthProviderType',
  description: 'Type of OAuth provider (GitHub, Google, or custom)',
});

@ObjectType()
@Entity('oauth_providers')
export class OAuthProvider {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty({ description: 'The name of the OAuth provider' })
  @Column()
  name: string;

  @Field()
  @ApiProperty({
    description:
      'The unique identifier for the provider (e.g., github, google, custom)',
  })
  @Column({ unique: true })
  providerId: string;

  @Field(() => OAuthProviderType)
  @ApiProperty({
    enum: OAuthProviderType,
    enumName: 'OAuthProviderType',
    description: 'The type of provider (GitHub, Google, or custom)',
  })
  @Column()
  type: OAuthProviderType;

  @Field()
  @ApiProperty({ description: 'The OAuth client ID' })
  @Column()
  clientId: string;

  @Field()
  @ApiProperty({ description: 'The OAuth client secret' })
  @Column()
  clientSecret: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Custom callback URL (if not using default)' })
  @Column({ nullable: true })
  callbackUrl?: string;

  @Field(() => [String])
  @ApiProperty({ description: 'Array of OAuth scopes', type: [String] })
  @Column('simple-array')
  scopes: string[];

  @Field()
  @ApiProperty({ description: 'Whether the provider is currently enabled' })
  @Column({ default: true })
  isEnabled: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Icon URL for the provider' })
  @Column({ nullable: true })
  iconUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Hex color code for the provider (e.g., #FF5733)',
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#0a7ea4',
  })
  @Column({ nullable: true })
  color?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Hex color code for the provider text (e.g., #FFFFFF)',
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#FFFFFF',
  })
  @Column({ nullable: true })
  textColor?: string;

  // Custom provider specific fields
  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Authorization URL for custom OAuth provider',
  })
  @Column({ nullable: true })
  authorizationUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Token URL for custom OAuth provider',
  })
  @Column({ nullable: true })
  tokenUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'User info URL for custom OAuth provider',
  })
  @Column({ nullable: true })
  userInfoUrl?: string;

  @Field(() => [String], { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Profile fields mapping for custom OAuth provider',
    type: [String],
  })
  @Column({ type: 'simple-array', nullable: true })
  profileFields?: string[];

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Additional configuration as JSON string',
  })
  @Column({ type: 'text', nullable: true })
  additionalConfig?: string;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
