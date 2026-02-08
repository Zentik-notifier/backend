import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

@InputType()
export class UpdateMessageDto {
  @Field(() => Date, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'When to send the message (scheduler will send at this time). Set to null to cancel scheduled send.',
  })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? undefined : new Date(value)))
  @IsDate()
  scheduledSendAt?: Date | null;
}
