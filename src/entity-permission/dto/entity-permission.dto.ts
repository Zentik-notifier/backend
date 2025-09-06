import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';

@ValidatorConstraint({ name: 'userIdentifierRequired', async: false })
export class UserIdentifierRequiredValidator
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    return !!(object.userId || object.userEmail || object.username);
  }

  defaultMessage(args: ValidationArguments) {
    return 'At least one of userId, userEmail, or username must be provided';
  }
}

@InputType()
export class GrantEntityPermissionInput {
  @Field(() => ResourceType)
  @ApiProperty({ enum: ResourceType })
  @IsEnum(ResourceType)
  resourceType: ResourceType;

  @Field()
  @ApiProperty()
  @IsUUID()
  resourceId: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'User ID (if provided, userEmail and username are ignored)',
  })
  @IsOptional()
  @IsUUID()
  @Validate(UserIdentifierRequiredValidator)
  userId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'User email (used if userId is not provided)',
  })
  @ValidateIf((o) => !o.userId && !o.username)
  @IsEmail()
  @IsOptional()
  userEmail?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Username (used if userId and userEmail are not provided)',
  })
  @ValidateIf((o) => !o.userId && !o.userEmail)
  @IsString()
  @IsOptional()
  username?: string;

  @Field(() => [Permission])
  @ApiProperty({ enum: Permission, isArray: true })
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

@InputType()
export class GetResourcePermissionsInput {
  @Field(() => ResourceType)
  @ApiProperty({ enum: ResourceType })
  @IsEnum(ResourceType)
  resourceType: ResourceType;

  @Field()
  @ApiProperty()
  @IsUUID()
  resourceId: string;
}

@InputType()
export class RevokeEntityPermissionInput {
  @Field(() => ResourceType)
  @ApiProperty({ enum: ResourceType })
  @IsEnum(ResourceType)
  resourceType: ResourceType;

  @Field()
  @ApiProperty()
  @IsUUID()
  resourceId: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'User ID (if provided, userEmail and username are ignored)',
  })
  @IsOptional()
  @IsUUID()
  @Validate(UserIdentifierRequiredValidator)
  userId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'User email (used if userId is not provided)',
  })
  @ValidateIf((o) => !o.userId && !o.username)
  @IsEmail()
  @IsOptional()
  userEmail?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Username (used if userId and userEmail are not provided)',
  })
  @ValidateIf((o) => !o.userId && !o.userEmail)
  @IsString()
  @IsOptional()
  username?: string;
}

@InputType()
export class GetAccessibleResourcesInput {
  @Field(() => ResourceType)
  @ApiProperty({ enum: ResourceType })
  @IsEnum(ResourceType)
  resourceType: ResourceType;
}
