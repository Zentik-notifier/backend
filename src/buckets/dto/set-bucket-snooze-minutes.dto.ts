import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

@InputType()
export class SetBucketSnoozeMinutesInput {
  @Field()
  @ApiProperty({
    type: Number,
    example: 60,
    description: 'Number of minutes to snooze the bucket from now',
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  minutes: number;
}
