import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    ValidateIf,
} from 'class-validator';
import { OAuthProviderType } from '../../entities';

@InputType()
export class UpdateOAuthProviderDto {
  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'The name of the OAuth provider',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description:
      'The unique identifier for the provider (e.g., github, google, custom)',
  })
  @IsOptional()
  @IsString()
  providerId?: string;

  @Field(() => OAuthProviderType, { nullable: true })
  @ApiProperty({
    required: false,
    enum: OAuthProviderType,
    enumName: 'OAuthProviderType',
    description: 'The type of provider (GitHub, Google, or custom)',
  })
  @IsOptional()
  @IsEnum(OAuthProviderType)
  type?: OAuthProviderType;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'The OAuth client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'The OAuth client secret' })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Custom callback URL (if not using default)',
  })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @Field(() => [String], { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Array of OAuth scopes',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Whether the provider is currently enabled',
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Icon URL for the provider' })
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Hex color code for the provider (e.g., #FF5733)',
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#0a7ea4',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Hex color code for the provider text (e.g., #FFFFFF)',
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#FFFFFF',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Text color must be a valid hex color code (e.g., #FFFFFF)',
  })
  textColor?: string;

  // Custom provider specific fields
  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Authorization URL for custom OAuth provider',
  })
  @IsOptional()
  @IsUrl()
  @ValidateIf((o) => o.type === OAuthProviderType.CUSTOM)
  authorizationUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Token URL for custom OAuth provider',
  })
  @IsOptional()
  @IsUrl()
  @ValidateIf((o) => o.type === OAuthProviderType.CUSTOM)
  tokenUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'User info URL for custom OAuth provider',
  })
  @IsOptional()
  @IsUrl()
  @ValidateIf((o) => o.type === OAuthProviderType.CUSTOM)
  userInfoUrl?: string;

  @Field(() => [String], { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Profile fields mapping for custom OAuth provider',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ValidateIf((o) => o.type === OAuthProviderType.CUSTOM)
  profileFields?: string[];

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Additional configuration as JSON string',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.type === OAuthProviderType.CUSTOM)
  additionalConfig?: string;
}
