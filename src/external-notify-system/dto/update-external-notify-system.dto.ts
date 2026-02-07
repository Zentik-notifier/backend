import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { ExternalNotifySystemType } from '../../entities/external-notify-system.entity';

@InputType()
export class UpdateExternalNotifySystemDto {
  @Field(() => ExternalNotifySystemType, { nullable: true })
  @ApiProperty({ enum: ExternalNotifySystemType, required: false })
  @IsOptional()
  @IsEnum(ExternalNotifySystemType)
  type?: ExternalNotifySystemType;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  baseUrl?: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'channel must contain only letters, numbers, underscore and hyphen',
  })
  channel?: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  iconUrl?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex code (e.g. #FF5733)',
  })
  color?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  authUser?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  authPassword?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  authToken?: string | null;
}
