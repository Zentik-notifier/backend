import {
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OAuthProviderPublicDto } from 'src/oauth-providers/dto/oauth-provider-public.dto';
import { User } from '../../entities/user.entity';
import { DevicePlatform } from '../../users/dto';

// Enums
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',
}

export enum ResourceType {
  BUCKET = 'bucket',
  USER_WEBHOOK = 'user_webhook',
}

// GraphQL registrations
registerEnumType(Permission, {
  name: 'Permission',
  description: 'Permission enum for bucket access',
});

registerEnumType(ResourceType, {
  name: 'ResourceType',
  description: 'Type of resource for permissions',
});

@ObjectType()
export class LoginResponse {
  @ApiProperty({ example: 'Login successful', required: false })
  @Field({ nullable: true })
  message?: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @Field()
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @Field()
  refreshToken: string;

  @ApiProperty({ type: () => User })
  @Field(() => User)
  user: Omit<User, 'password'>;
}

@ObjectType()
export class RegisterResponse {
  @ApiProperty({ example: 'Registration completed successfully' })
  @Field()
  message: string;

  @ApiProperty({ type: () => User })
  @Field(() => User)
  user: Omit<User, 'password'>;

  @ApiProperty({
    description:
      'If true, the client must guide the user through email confirmation',
    example: true,
  })
  @Field()
  emailConfirmationRequired: boolean;

  @ApiProperty({
    required: false,
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Field({ nullable: true })
  accessToken?: string;

  @ApiProperty({
    required: false,
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Field({ nullable: true })
  refreshToken?: string;
}

@ObjectType()
export class ProfileResponse {
  @ApiProperty({ example: 'User profile', required: false })
  @Field({ nullable: true })
  message?: string;

  @ApiProperty({ type: () => User })
  @Field(() => User)
  user: Omit<User, 'password'>;
}

@ObjectType()
export class RefreshTokenResponse {
  @ApiProperty({ example: 'Token refreshed successfully', required: false })
  @Field({ nullable: true })
  message?: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @Field()
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @Field()
  refreshToken: string;
}

@InputType()
export class DeviceInfoDto {
  @ApiProperty({ required: false, example: 'iPhone 15 Pro' })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  deviceName?: string;

  @ApiProperty({ required: false, example: 'iPhone 15 Pro' })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  deviceModel?: string;

  @ApiProperty({ required: false, enum: DevicePlatform, example: 'ios' })
  @IsOptional()
  @IsEnum(DevicePlatform)
  @Field({ nullable: true })
  platform?: string;

  @ApiProperty({ required: false, example: '17.0.1' })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  osVersion?: string;
}

@InputType()
export class LoginDto {
  @ApiProperty({
    required: false,
    description: 'Email address for login (required if username not provided)',
  })
  @ValidateIf((o) => !o.username)
  @IsEmail({}, { message: 'Invalid email' })
  @IsOptional()
  @Field({ nullable: true })
  email?: string;

  @ApiProperty({
    required: false,
    description: 'Username for login (required if email not provided)',
  })
  @ValidateIf((o) => !o.email)
  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  username?: string;

  @ApiProperty({ description: 'Password for login', minLength: 3 })
  @IsString()
  @MinLength(3, { message: 'Password must be at least 3 characters' })
  @Field()
  password: string;

  @ApiProperty({
    required: false,
    description: 'Device information for session tracking',
  })
  @IsOptional()
  @IsObject({ message: 'deviceInfo must be an object' })
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  @Field(() => DeviceInfoDto, { nullable: true })
  deviceInfo?: DeviceInfoDto;
}

@InputType()
export class RegisterDto {
  @ApiProperty({ description: 'Email address for registration' })
  @IsEmail({}, { message: 'Invalid email' })
  @IsNotEmpty()
  @Field()
  email: string;

  @ApiProperty({
    description: 'Username for registration',
    minLength: 3,
    maxLength: 30,
  })
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username cannot exceed 30 characters' })
  @IsNotEmpty()
  @Field()
  username: string;

  @ApiProperty({
    description: 'Password for registration',
    minLength: 6,
    maxLength: 100,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(100, { message: 'Password too long' })
  @IsNotEmpty()
  @Field()
  password: string;

  @ApiProperty({ required: false, description: 'First name', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Field({ nullable: true })
  firstName?: string;

  @ApiProperty({ required: false, description: 'Last name', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Field({ nullable: true })
  lastName?: string;

  @ApiProperty({
    required: false,
    description: 'Preferred locale for the user',
    example: 'en-EN',
  })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  locale?: string;
}

@InputType()
export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token for authentication renewal' })
  @IsString()
  @Field()
  refreshToken: string;
}

@InputType('ChangePasswordInput')
export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password for verification' })
  @IsString()
  @Field()
  currentPassword: string;

  @ApiProperty({ description: 'New password to set', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @Field()
  newPassword: string;
}

@InputType('SetPasswordInput')
export class SetPasswordDto {
  @ApiProperty({ description: 'New password to set', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @Field()
  newPassword: string;
}

@InputType('UpdateProfileInput')
export class UpdateProfileDto {
  @ApiProperty({ required: false, description: 'First name', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Field({ nullable: true })
  firstName?: string;

  @ApiProperty({ required: false, description: 'Last name', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Field({ nullable: true })
  lastName?: string;

  @ApiProperty({
    required: false,
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Avatar must be a valid URL' })
  @Field({ nullable: true })
  avatar?: string;
}

// GraphQL Auth result type
@ObjectType()
export class AuthResult {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => User)
  user: User;
}

// Access Token DTOs
@InputType()
export class CreateAccessTokenDto {
  @ApiProperty({ description: 'Name/description for the access token' })
  @IsString()
  @IsNotEmpty()
  @Field()
  name: string;

  @ApiProperty({
    description:
      'Expiration date for the token (optional, null for never expires)',
    required: false,
  })
  @IsOptional()
  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Optional scopes/permissions for the token',
    required: false,
    type: [String],
  })
  @IsString({ each: true })
  @IsOptional()
  @Field(() => [String], { nullable: true })
  scopes?: string[];
}

@ObjectType()
export class AccessTokenResponseDto {
  @ApiProperty({ description: 'The generated access token (only shown once)' })
  @Field()
  token: string;

  @ApiProperty({ description: 'Token ID for management' })
  @Field()
  id: string;

  @ApiProperty({ description: 'Token name/description' })
  @Field()
  name: string;

  @ApiProperty({ description: 'Token expiration date', required: false })
  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @ApiProperty({ description: 'Token creation date' })
  @Field()
  createdAt: Date;
}

@ObjectType()
export class SystemAccessTokenResponseDto {
  @ApiProperty({ description: 'Token ID for management' })
  @Field()
  id: string;

  @ApiProperty({ description: 'The generated system token (only shown once)' })
  @Field()
  token: string;

  @ApiProperty({ description: 'Max allowed calls' })
  @Field()
  maxCalls: number;

  @ApiProperty({ description: 'Current calls count' })
  @Field()
  calls: number;

  @ApiProperty({ description: 'Token expiration date', required: false })
  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @ApiProperty({ description: 'Requester user ID', required: false })
  @Field({ nullable: true })
  requesterId?: string;

  @ApiProperty({ description: 'Description', required: false })
  @Field({ nullable: true })
  description?: string;

  @ApiProperty({ description: 'Token creation date' })
  @Field()
  createdAt: Date;
}

@ObjectType()
export class AccessTokenListDto {
  @ApiProperty({ description: 'Token ID' })
  @Field()
  id: string;

  @ApiProperty({ description: 'Token name/description' })
  @Field()
  name: string;

  @ApiProperty({ description: 'Token expiration date', required: false })
  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @ApiProperty({ description: 'Token creation date' })
  @Field()
  createdAt: Date;

  @ApiProperty({ description: 'Last time the token was used', required: false })
  @Field(() => Date, { nullable: true })
  lastUsed?: Date;

  @ApiProperty({ description: 'Whether the token is expired' })
  @Field()
  isExpired: boolean;
}

@InputType()
export class RequestPasswordResetDto {
  @ApiProperty({ description: 'Email address for password reset' })
  @IsEmail({}, { message: 'Invalid email' })
  @IsNotEmpty()
  @Field()
  email: string;

  @ApiProperty({
    description: 'Preferred language for email content (e.g., en-EN, it-IT)',
    required: false,
    default: 'en-EN',
    example: 'en-EN',
  })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  locale?: string;
}

@InputType()
export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token received via email' })
  @IsString()
  @IsNotEmpty()
  @Field()
  resetToken: string;

  @ApiProperty({
    description: 'New password',
    minLength: 8,
    example: 'newSecurePassword123',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Field()
  newPassword: string;
}

@ObjectType()
export class PasswordResetResponseDto {
  @ApiProperty({ description: 'Whether the password reset was successful' })
  @Field()
  success: boolean;

  @ApiProperty({ description: 'Message about the operation result' })
  @Field()
  message: string;
}

@ObjectType()
export class EmailStatusResponseDto {
  @ApiProperty({ description: 'Whether the email is confirmed' })
  @Field()
  confirmed: boolean;

  @ApiProperty({ description: 'Message about the email status' })
  @Field()
  message: string;
}

@ObjectType()
export class PublicAppConfig {
  @Field(() => [OAuthProviderPublicDto])
  oauthProviders: OAuthProviderPublicDto[];

  @Field()
  emailEnabled: boolean;
}
