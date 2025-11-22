import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Attachment } from '../entities/attachment.entity';
import { AttachmentsService } from './attachments.service';

@Resolver(() => Attachment)
@UseGuards(JwtOrAccessTokenGuard)
export class AttachmentsResolver {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Query(() => [Attachment])
  async userAttachments(
    @Args('userId', { type: () => ID }) userId: string,
    @GetUser('id') requestingUserId: string,
  ): Promise<Attachment[]> {
    if (userId !== requestingUserId) {
      throw new Error('You can only access your own attachments');
    }
    return this.attachmentsService.findByUser(userId);
  }

  @Query(() => Attachment)
  async attachment(
    @Args('id', { type: () => ID }) id: string,
    @GetUser('id') userId: string,
  ): Promise<Attachment> {
    return this.attachmentsService.findOne(id, userId);
  }

  @Query(() => [Attachment])
  async messageAttachments(
    @Args('messageId', { type: () => ID }) messageId: string,
    @GetUser('id') userId: string,
  ): Promise<Attachment[]> {
    return this.attachmentsService.findByMessage(messageId, userId);
  }

  @Mutation(() => Boolean)
  async deleteAttachment(
    @Args('id', { type: () => ID }) id: string,
    @GetUser('id') userId: string,
  ): Promise<boolean> {
    await this.attachmentsService.remove(id, userId);
    return true;
  }
}
