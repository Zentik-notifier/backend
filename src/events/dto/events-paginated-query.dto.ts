import { Field, InputType, Int } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsPositive, Max, Min } from 'class-validator';

@InputType()
export class EventsPaginatedQueryDto {
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
}
