import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { InviteCode } from '../entities/invite-code.entity';
import { InviteCodeService } from './invite-code.service';
import {
  CreateInviteCodeInput,
  RedeemInviteCodeInput,
  InviteCodeRedemptionResult,
} from './dto/invite-code.dto';
import { ResourceType } from '../auth/dto/auth.dto';

@Resolver(() => InviteCode)
@UseGuards(JwtOrAccessTokenGuard)
@Injectable()
export class InviteCodeResolver {
  constructor(private readonly inviteCodeService: InviteCodeService) {}

  @Mutation(() => InviteCode, { description: 'Create a new invite code for a resource' })
  async createInviteCode(
    @Args('input') input: CreateInviteCodeInput,
    @CurrentUser('id') userId: string,
  ): Promise<InviteCode> {
    return this.inviteCodeService.createInviteCode(input, userId);
  }

  @Query(() => [InviteCode], { description: 'Get invite codes for a resource' })
  async inviteCodesForResource(
    @Args('resourceType', { type: () => String }) resourceType: ResourceType,
    @Args('resourceId') resourceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<InviteCode[]> {
    return this.inviteCodeService.getInviteCodesForResource(
      resourceType,
      resourceId,
      userId,
    );
  }

  @Query(() => InviteCode, { description: 'Get invite code by ID' })
  async inviteCode(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<InviteCode> {
    return this.inviteCodeService.getInviteCodeById(id, userId);
  }

  @Mutation(() => InviteCodeRedemptionResult, { description: 'Redeem an invite code to gain access' })
  async redeemInviteCode(
    @Args('input') input: RedeemInviteCodeInput,
    @CurrentUser('id') userId: string,
  ): Promise<InviteCodeRedemptionResult> {
    return this.inviteCodeService.redeemInviteCode(input.code, userId);
  }

  @Mutation(() => Boolean, { description: 'Delete an invite code' })
  async deleteInviteCode(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.inviteCodeService.deleteInviteCode(id, userId);
    return true;
  }
}

