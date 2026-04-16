import { UseGuards } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';

@Resolver()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class MessagesCronResolver {
  constructor(private readonly messagesService: MessagesService) {}

  @Mutation(() => String, {
    name: 'triggerMessagesCleanup',
    description:
      'Manually trigger the messages cleanup cron job (deletes ephemeral, expired and fully-received messages)',
  })
  async triggerMessagesCleanup(): Promise<string> {
    const { deletedMessages } =
      await this.messagesService.deleteMessagesFullyRead();
    return `Deleted ${deletedMessages} message(s)`;
  }
}
