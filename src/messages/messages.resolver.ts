import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Message } from '../entities/message.entity';
import { CreateMessageDto } from './dto';
import { MessagesService } from './messages.service';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';

@Resolver(() => Message)
@UseGuards(JwtOrAccessTokenGuard)
@Injectable()
export class MessagesResolver {
  private readonly logger = new Logger('MessagesResolver');

  constructor(private readonly messagesService: MessagesService) {}

  @Mutation(() => Message, {
    description:
      'Create a new message and send notifications to bucket users (returns the created message).',
  })
  async createMessage(
    @Args('input') input: CreateMessageDto,
    @CurrentUser('id') userId: string,
  ): Promise<Message> {
    return this.messagesService.create(input, userId);
  }
}
