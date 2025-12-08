import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

@InputType()
export class UpdateUserTemplateDto {
  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Template name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Template description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Title template' })
  @IsOptional()
  @IsString()
  title?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Subtitle template' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Body template' })
  @IsOptional()
  @IsString()
  body?: string;
}
