import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsEnum } from 'class-validator';
import { EventType } from '../../entities/event.entity';

@InputType()
export class CreateAdminSubscriptionDto {
  @Field(() => [String])
  @ApiProperty({
    type: [String],
    enum: EventType,
    description: 'Array of EventType subscriptions',
    example: ['LOGIN', 'MESSAGE'],
  })
  @IsArray()
  @IsEnum(EventType, { each: true })
  eventTypes: EventType[];
}

@InputType()
export class UpdateAdminSubscriptionDto {
  @Field(() => [String])
  @ApiProperty({
    type: [String],
    enum: EventType,
    description: 'Array of EventType subscriptions',
    example: ['LOGIN', 'MESSAGE'],
  })
  @IsArray()
  @IsEnum(EventType, { each: true })
  eventTypes: EventType[];
}
