import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { ExternalNotifySystemType } from '../../entities/external-notify-system.entity';

@InputType()
export class CreateExternalNotifySystemDto {
  @Field(() => ExternalNotifySystemType)
  @ApiProperty({ enum: ExternalNotifySystemType })
  @IsEnum(ExternalNotifySystemType)
  type: ExternalNotifySystemType;

  @Field()
  @ApiProperty({ description: 'User-defined name (e.g. "NTFY Casa")' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @Field()
  @ApiProperty({ description: 'Base URL of the external notification service' })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  @MaxLength(2048)
  baseUrl: string;

  @Field()
  @ApiProperty({
    description: 'Topic (NTFY), app id (Gotify), or generic channel identifier',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'channel must contain only letters, numbers, underscore and hyphen',
  })
  channel: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  iconUrl?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, example: '#0a7ea4' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex code (e.g. #FF5733)',
  })
  color?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, description: 'Auth username for the external system' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  authUser?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, description: 'Auth password for the external system' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  authPassword?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, description: 'Auth token for the external system' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  authToken?: string | null;
}
