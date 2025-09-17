import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { UserWebhook } from '../entities';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { WebhooksService } from './webhooks.service';

@Resolver(() => UserWebhook)
@UseGuards(JwtOrAccessTokenGuard)
export class WebhooksResolver {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Query(() => [UserWebhook])
  async userWebhooks(@GetUser('id') userId: string): Promise<UserWebhook[]> {
    return this.webhooksService.getUserWebhooks(userId);
  }

  @Query(() => UserWebhook)
  async webhook(
    @Args('id', { type: () => ID }) id: string,
    @GetUser('id') userId: string,
  ): Promise<UserWebhook> {
    return this.webhooksService.getWebhookById(id, userId);
  }

  @Mutation(() => UserWebhook)
  async createWebhook(
    @Args('input') input: CreateWebhookDto,
    @GetUser('id') userId: string,
  ): Promise<UserWebhook> {
    return this.webhooksService.createWebhook(userId, input);
  }

  @Mutation(() => UserWebhook)
  async updateWebhook(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWebhookDto,
    @GetUser('id') userId: string,
  ): Promise<UserWebhook> {
    return this.webhooksService.updateWebhook(id, userId, input);
  }

  @Mutation(() => Boolean)
  async deleteWebhook(
    @Args('id', { type: () => ID }) id: string,
    @GetUser('id') userId: string,
  ): Promise<boolean> {
    return this.webhooksService.deleteWebhook(id, userId);
  }

  @Mutation(() => Boolean)
  async executeWebhook(
    @Args('id', { type: () => ID }) id: string,
    @GetUser('id') userId: string,
  ): Promise<boolean> {
    await this.webhooksService.executeWebhook(id, userId);
    return true;
  }
}
