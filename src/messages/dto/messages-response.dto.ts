import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Message } from '../../entities/message.entity';

@ObjectType()
export class MessagesResponseDto {
  @Field(() => [Message])
  @ApiProperty({ type: [Message], description: 'List of messages' })
  messages: Message[];

  @Field(() => Int)
  @ApiProperty({ description: 'Total number of messages' })
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
