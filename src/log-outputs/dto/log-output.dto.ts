import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { LogLevel, LogOutputType } from '../../entities/log-output.entity';

@InputType()
export class CreateLogOutputDto {
  @Field()
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @Field(() => LogOutputType)
  @ApiProperty({ enum: LogOutputType })
  @IsEnum(LogOutputType)
  type: LogOutputType;

  @Field({ nullable: true, defaultValue: true })
  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsUrl()
  @IsOptional()
  @ValidateIf((o) => o.type === LogOutputType.PROMTAIL)
  promtailUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  promtailUsername?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  promtailPassword?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  promtailLabels?: Record<string, string>;

  // Syslog fields
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.type === LogOutputType.SYSLOG)
  syslogHost?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  syslogPort?: number;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  syslogProtocol?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  syslogAppName?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  syslogFacility?: string;

  // Common fields
  @Field(() => LogLevel, { nullable: true, defaultValue: LogLevel.INFO })
  @ApiProperty({ enum: LogLevel, required: false, default: LogLevel.INFO })
  @IsEnum(LogLevel)
  @IsOptional()
  minLevel?: LogLevel;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  additionalConfig?: string;
}

@InputType()
export class UpdateLogOutputDto {
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsUrl()
  @IsOptional()
  promtailUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  promtailUsername?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  promtailPassword?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  promtailLabels?: Record<string, string>;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  syslogHost?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  syslogPort?: number;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  syslogProtocol?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  syslogAppName?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  syslogFacility?: string;

  @Field(() => LogLevel, { nullable: true })
  @ApiProperty({ enum: LogLevel, required: false })
  @IsEnum(LogLevel)
  @IsOptional()
  minLevel?: LogLevel;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  additionalConfig?: string;
}
