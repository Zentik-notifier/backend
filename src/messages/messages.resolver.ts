import { Injectable, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { RequireMessageBucketCreation } from '../auth/decorators/require-scopes.decorator';
import { MagicCodeGuard } from '../auth/guards/magic-code.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { Message } from '../entities/message.entity';
import { MessageReminder } from '../entities/message-reminder.entity';
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
    const message = await this.messagesService.deleteMessage(id, userId);
    return message != null;
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
