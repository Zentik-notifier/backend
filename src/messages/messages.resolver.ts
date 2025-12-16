import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { RequireMessageBucketCreation } from '../auth/decorators/require-scopes.decorator';
import { MagicCodeGuard } from '../auth/guards/magic-code.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { Message } from '../entities/message.entity';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { CreateMessageDto } from './dto';
import { MessagesService } from './messages.service';

@Resolver(() => Message)
@UseGuards(MagicCodeGuard, ScopesGuard)
@Injectable()
export class MessagesResolver {
  constructor(private readonly messagesService: MessagesService) {}

  @Mutation(() => Message, {
    description:
      'Create a new message and send notifications to bucket users (returns the created message).',
  })
  @RequireMessageBucketCreation('bucketId')
  async createMessage(
    @Args('input') input: CreateMessageDto,
    @CurrentUser('id') userId: string | undefined,
  ): Promise<Message> {
    const { message } = await this.messagesService.create(input, userId);
    return message;
  }
}
