import { Injectable, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { RequireMessageBucketCreation } from '../auth/decorators/require-scopes.decorator';
import { MagicCodeGuard } from '../auth/guards/magic-code.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { Message } from '../entities/message.entity';
import { MessageReminder } from '../entities/message-reminder.entity';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { CreateMessageDto, UpdateMessageDto } from './dto';
import { MessageReminderService } from './message-reminder.service';
import { MessagesService } from './messages.service';

@Resolver(() => Message)
@UseGuards(MagicCodeGuard, ScopesGuard)
@Injectable()
export class MessagesResolver {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly reminderService: MessageReminderService,
    private readonly subscriptionService: GraphQLSubscriptionService,
  ) {}

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

  @Mutation(() => Message, {
    description: 'Update a message (e.g. scheduled send time).',
  })
  async updateMessage(
    @Args('id') id: string,
    @Args('input') input: UpdateMessageDto,
    @CurrentUser('id') userId: string | undefined,
  ): Promise<Message> {
    if (!userId) throw new UnauthorizedException('Unauthorized');
    return this.messagesService.updateMessage(id, userId, input);
  }

  @Query(() => [Message], {
    description: 'Messages with scheduled send in the future (user must have write on bucket).',
  })
  async scheduledMessagesForCurrentUser(
    @CurrentUser('id') userId: string | undefined,
  ): Promise<Message[]> {
    if (!userId) return [];
    return this.messagesService.findScheduledForUser(userId);
  }

  @Query(() => [MessageReminder], {
    description: 'Active message reminders (retry) for the current user.',
  })
  async messageRemindersForCurrentUser(
    @CurrentUser('id') userId: string | undefined,
  ): Promise<MessageReminder[]> {
    if (!userId) return [];
    return this.reminderService.findByUser(userId);
  }

  @Mutation(() => Boolean, {
    description: 'Delete a message (user must have write on bucket). Returns true if deleted.',
  })
  async deleteMessage(
    @Args('id') id: string,
    @CurrentUser('id') userId: string | undefined,
  ): Promise<boolean> {
    if (!userId) throw new UnauthorizedException('Unauthorized');
    const { message, affectedUserIds } = await this.messagesService.deleteMessage(id, userId);
    if (message) {
      for (const uid of affectedUserIds) {
        await this.subscriptionService.publishMessageDeleted(message.id, uid);
      }
    }
    return message != null;
  }

  @Subscription(() => Message, {
    description:
      'Emitted when a new message is created and the current user receives a notification for it. Optionally filter by bucketId.',
    filter: (payload, variables, context) => {
      const userId = context?.req?.user?.id;
      if (!userId || payload.userId !== userId) return false;
      const bucketId = variables?.bucketId;
      if (bucketId != null && bucketId !== '') {
        return payload.messageCreated?.bucketId === bucketId;
      }
      return true;
    },
  })
  messageCreated(@Args('bucketId', { nullable: true }) _bucketId?: string) {
    return this.subscriptionService.messageCreated();
  }

  @Subscription(() => Message, {
    description:
      'Same as messageCreated: new messages for the current user only. Use this name when you only care about new messages (optionally in a bucket).',
    filter: (payload, variables, context) => {
      const userId = context?.req?.user?.id;
      if (!userId || payload.userId !== userId) return false;
      const bucketId = variables?.bucketId;
      if (bucketId != null && bucketId !== '') {
        return payload.messageCreated?.bucketId === bucketId;
      }
      return true;
    },
  })
  newMessagesForUser(@Args('bucketId', { nullable: true }) _bucketId?: string) {
    return this.subscriptionService.messageCreated();
  }

  @Subscription(() => String, {
    description: 'Emitted when a message the current user had a notification for is deleted.',
    filter: (payload, _variables, context) => {
      const userId = context?.req?.user?.id;
      return !!userId && payload.userId === userId;
    },
  })
  messageDeleted() {
    return this.subscriptionService.messageDeleted();
  }

  @Mutation(() => Int, {
    description: 'Cancel all reminders for a message for the current user.',
  })
  async cancelMessageReminders(
    @Args('messageId') messageId: string,
    @CurrentUser('id') userId: string | undefined,
  ): Promise<number> {
    if (!userId) throw new UnauthorizedException('Unauthorized');
    return this.reminderService.cancelRemindersByMessageAndUser(messageId, userId);
  }
}
