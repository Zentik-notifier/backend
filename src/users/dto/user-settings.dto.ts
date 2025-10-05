import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { UserSettingType } from '../../entities/user-setting.entity';

@InputType()
export class UpsertUserSettingInput {
  @Field(() => UserSettingType)
  @ApiProperty({ enum: UserSettingType })
  @IsEnum(UserSettingType)
  configType: UserSettingType;

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

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  deviceId?: string | null;
}
