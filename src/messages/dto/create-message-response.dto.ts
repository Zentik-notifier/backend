import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Message } from '../../entities/message.entity';

@ObjectType()
export class CreateMessageResponseDto {
  @Field(() => Message)
  @ApiProperty({ type: () => Message, description: 'Created message' })
  message: Message;

  @Field(() => Int)
  @ApiProperty({ description: 'Number of notifications created for this message' })
  notificationsCount: number;
}
