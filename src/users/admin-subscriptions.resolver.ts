import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import {
  CreateAdminSubscriptionDto,
  UpdateAdminSubscriptionDto,
} from './dto/admin-subscription.dto';
import { AdminSubscription } from '../entities/admin-subscription.entity';

@Resolver(() => AdminSubscription)
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class AdminSubscriptionsResolver {
  constructor(
    private readonly adminSubscriptionsService: AdminSubscriptionsService,
  ) {}

  @Mutation(() => AdminSubscription)
  async createAdminSubscription(
    @CurrentUser() user: any,
    @Args('input') createDto: CreateAdminSubscriptionDto,
  ): Promise<AdminSubscription> {
    return this.adminSubscriptionsService.create(user.userId, createDto);
  }

  @Query(() => [AdminSubscription])
  async adminSubscriptions(): Promise<AdminSubscription[]> {
    return this.adminSubscriptionsService.findAll();
  }

  @Query(() => AdminSubscription, { nullable: true })
  async myAdminSubscription(
    @CurrentUser() user: any,
  ): Promise<AdminSubscription | null> {
    return this.adminSubscriptionsService.findByUserId(user.userId);
  }

  @Query(() => AdminSubscription)
  async adminSubscription(
    @Args('id') id: string,
  ): Promise<AdminSubscription> {
    return this.adminSubscriptionsService.findOne(id);
  }

  @Mutation(() => AdminSubscription)
  async updateAdminSubscription(
    @Args('id') id: string,
    @Args('input') updateDto: UpdateAdminSubscriptionDto,
  ): Promise<AdminSubscription> {
    return this.adminSubscriptionsService.update(id, updateDto);
  }

  @Mutation(() => Boolean)
  async deleteAdminSubscription(@Args('id') id: string): Promise<boolean> {
    await this.adminSubscriptionsService.remove(id);
    return true;
  }
}
