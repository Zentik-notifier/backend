import { Field, InputType, Int } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsPositive, IsString, Max, Min, IsEnum } from 'class-validator';
import { EventType } from '../../entities';

@InputType()
export class EventsQueryDto {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @ApiProperty({
    required: false,
    minimum: 1,
    default: 1,
    description: 'Page number (1-based)',
  })
  @IsOptional()
  @IsPositive()
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @ApiProperty({
    required: false,
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Number of items per page',
  })
  @IsOptional()
  @IsPositive()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @Field(() => EventType, { nullable: true })
  @ApiProperty({
    required: false,
    enum: EventType,
    description: 'Filter events by type',
  })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Filter events by user ID',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Filter events by object ID',
  })
  @IsOptional()
  @IsString()
  objectId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Filter events by target ID',
  })
  @IsOptional()
  @IsString()
  targetId?: string;
}
