import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SnoozeScheduleInput } from './snooze-schedule.input';

@InputType()
export class CreateUserBucketDto {
  @Field()
  @ApiProperty({ description: 'ID of the bucket' })
  @IsUUID()
  bucketId: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Date until which notifications from this bucket are snoozed',
  })
  @IsOptional()
  @IsDateString()
  snoozeUntil?: string;

  @Field(() => [SnoozeScheduleInput], { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Array of snooze schedules for recurring snooze periods',
    type: () => [SnoozeScheduleInput],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SnoozeScheduleInput)
  snoozes?: SnoozeScheduleInput[];
}
