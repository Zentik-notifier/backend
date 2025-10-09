import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ServerSettingType } from '../../entities/server-setting.entity';

@InputType()
export class CreateServerSettingDto {
  @Field(() => ServerSettingType)
  @ApiProperty({ enum: ServerSettingType })
  @IsEnum(ServerSettingType)
  configType: ServerSettingType;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  valueText?: string | null;

  @Field(() => Boolean, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  valueBool?: boolean | null;

  @Field(() => Number, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  valueNumber?: number | null;

  @Field(() => [String], { nullable: true })
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  possibleValues?: string[] | null;
}

@InputType()
export class UpdateServerSettingDto {
  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  valueText?: string | null;

  @Field(() => Boolean, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  valueBool?: boolean | null;

  @Field(() => Number, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  valueNumber?: number | null;
}

@InputType()
export class BatchUpdateSettingInput {
  @Field(() => ServerSettingType)
  @ApiProperty({ enum: ServerSettingType })
  @IsEnum(ServerSettingType)
  configType: ServerSettingType;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  valueText?: string | null;

  @Field(() => Boolean, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  valueBool?: boolean | null;

  @Field(() => Number, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  valueNumber?: number | null;
}
