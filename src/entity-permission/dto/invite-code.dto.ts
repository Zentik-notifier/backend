import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Permission, ResourceType } from '../../auth/dto/auth.dto';

@InputType()
export class CreateInviteCodeInput {
  @Field(() => String, { description: 'Resource type' })
  @ApiProperty({ enum: ResourceType })
  @IsEnum(ResourceType)
  resourceType: ResourceType;

  @Field(() => String, { description: 'Resource ID' })
  @ApiProperty()
  @IsString()
  resourceId: string;

  @Field(() => [String], { description: 'Permissions to grant' })
  @ApiProperty({ enum: Permission, isArray: true })
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];

  @Field(() => String, { nullable: true, description: 'Expiration date (ISO string)' })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  expiresAt?: string;

  @Field(() => Int, { nullable: true, description: 'Maximum number of uses' })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;
}

@InputType()
export class RedeemInviteCodeInput {
  @Field(() => String, { description: 'Invite code to redeem' })
  @ApiProperty()
  @IsString()
  code: string;
}

@ObjectType()
export class InviteCodeRedemptionResult {
  @Field(() => Boolean, { description: 'Whether redemption was successful' })
  success: boolean;

  @Field(() => String, { nullable: true, description: 'Error message if redemption failed' })
  error?: string;

  @Field(() => String, { nullable: true, description: 'Resource type that was granted access to' })
  resourceType?: ResourceType;

  @Field(() => String, { nullable: true, description: 'Resource ID that was granted access to' })
  resourceId?: string;

  @Field(() => [String], { nullable: true, description: 'Permissions that were granted' })
  permissions?: Permission[];
}

