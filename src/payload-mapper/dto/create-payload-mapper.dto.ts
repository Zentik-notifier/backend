import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserSettingType } from '../../entities/user-setting.types';

@InputType()
export class CreatePayloadMapperDto {
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field()
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field()
  @ApiProperty({
    description: 'JavaScript function as stringified code for payload mapping',
  })
  @IsNotEmpty()
  @IsString()
  jsEvalFn: string;

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
