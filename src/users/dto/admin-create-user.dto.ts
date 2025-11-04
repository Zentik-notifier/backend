import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType('AdminCreateUserInput')
export class AdminCreateUserInput {
  @ApiProperty({ description: 'Email address for the new user' })
  @IsEmail({}, { message: 'Invalid email' })
  @IsNotEmpty()
  @Field()
  email: string;

  @ApiProperty({ description: 'Username for the new user', minLength: 3, maxLength: 30 })
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username cannot exceed 30 characters' })
  @IsNotEmpty()
  @Field()
  username: string;

  @ApiProperty({ description: 'Password for the new user', minLength: 6, maxLength: 100 })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(100, { message: 'Password too long' })
  @IsNotEmpty()
  @Field()
  password: string;

  @ApiProperty({ description: 'Skip email confirmation (admin only)', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true })
  skipEmailConfirmation?: boolean;
}


