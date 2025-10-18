import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserSettingType } from '../../entities/user-setting.types';

@InputType()
export class UpdatePayloadMapperDto {
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'JavaScript function as stringified code for payload mapping',
    required: false,
  })
  @IsOptional()
  @IsString()
  jsEvalFn?: string;

  @Field(() => [UserSettingType], { nullable: true })
  @ApiProperty({
    type: [String],
    enum: UserSettingType,
    required: false,
    description: 'Array of required user setting types for this payload mapper',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserSettingType, { each: true })
  requiredUserSettings?: UserSettingType[];
}
