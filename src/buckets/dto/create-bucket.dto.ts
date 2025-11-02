import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

@InputType()
export class CreateBucketDto {
  @Field()
  @ApiProperty({ description: 'The name of the bucket' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Icon for the bucket' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  icon?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Description of the bucket' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Hex color code for the bucket (e.g., #FF5733)',
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#0a7ea4',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Whether the bucket is protected from deletion',
    default: false,
  })
  @IsOptional()
  isProtected?: boolean;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Whether the bucket is publicly accessible',
    default: false,
  })
  @IsOptional()
  isPublic?: boolean;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Whether to generate bucket icon with initials',
    default: true,
  })
  @IsOptional()
  generateIconWithInitials?: boolean;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Whether to generate a magic code for unauthenticated access',
    default: true,
  })
  @IsOptional()
  generateMagicCode?: boolean;
}
