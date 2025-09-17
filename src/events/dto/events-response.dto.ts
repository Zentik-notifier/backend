import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Event } from '../../entities/event.entity';

@ObjectType()
export class EventsResponseDto {
  @Field(() => [Event])
  @ApiProperty({ type: [Event], description: 'List of events' })
  events: Event[];

  @Field(() => Int)
  @ApiProperty({ description: 'Total number of events' })
  total: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Current page number' })
  page: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Total number of pages' })
  get totalPages(): number {
    return Math.ceil(this.total / this.limit);
  }

  @Field(() => Boolean)
  @ApiProperty({ description: 'Whether there are more pages' })
  get hasNextPage(): boolean {
    return this.page < this.totalPages;
  }

  @Field(() => Boolean)
  @ApiProperty({ description: 'Whether there are previous pages' })
  get hasPreviousPage(): boolean {
    return this.page > 1;
  }
}
