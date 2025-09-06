import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsString } from 'class-validator';

@InputType('SnoozeScheduleInput')
export class SnoozeScheduleInput {
  @Field(() => [String])
  @ApiProperty({ description: 'Days of the week when snooze is active' })
  @IsArray()
  @IsString({ each: true })
  days: string[];

  @Field()
  @ApiProperty({ description: 'Start time for snooze period' })
  @IsString()
  timeFrom: string;

  @Field()
  @ApiProperty({ description: 'End time for snooze period' })
  @IsString()
  timeTill: string;

  @Field()
  @ApiProperty({ description: 'Whether this snooze schedule is enabled' })
  @IsBoolean()
  isEnabled: boolean;
}
