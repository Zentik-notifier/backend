import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { SystemAccessTokenDto } from './dto';
import { SystemAccessTokenService } from './system-access-token.service';
import { SystemAccessTokenResetScheduler } from './system-access-token.reset.scheduler';

@Resolver()
@UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
@Injectable()
export class SystemAccessTokenResolver {
  constructor(
    private readonly service: SystemAccessTokenService,
    private readonly resetScheduler: SystemAccessTokenResetScheduler,
  ) {}

  @Mutation(() => SystemAccessTokenDto)
  async createSystemToken(
    @Args('maxCalls') maxCalls: number,
    @Args('expiresAt', { nullable: true }) expiresAt?: string,
    @Args('requesterId', { nullable: true }) requesterId?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('scopes', { nullable: true, type: () => [String] }) scopes?: string[],
  ) {
    return await this.service.createToken(
      maxCalls,
      expiresAt ? new Date(expiresAt) : undefined,
      requesterId,
      description,
      scopes,
    );
  }

  @Query(() => [SystemAccessTokenDto])
  async listSystemTokens() {
    return await this.service.findAll();
  }

  @Query(() => SystemAccessTokenDto, { nullable: true })
  async getSystemToken(@Args('id') id: string) {
    return await this.service.findOne(id);
  }

  @Mutation(() => SystemAccessTokenDto)
  async updateSystemToken(
    @Args('id') id: string,
    @Args('maxCalls', { nullable: true }) maxCalls?: number,
    @Args('expiresAt', { nullable: true }) expiresAt?: string,
    @Args('requesterId', { nullable: true }) requesterId?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('scopes', { nullable: true, type: () => [String] }) scopes?: string[],
  ) {
    return await this.service.updateToken(
      id,
      maxCalls,
      expiresAt ? new Date(expiresAt) : undefined,
      requesterId,
      description,
      scopes,
    );
  }

  @Mutation(() => Boolean)
  async revokeSystemToken(@Args('id') id: string) {
    return await this.service.revoke(id);
  }

  @Mutation(() => String, {
    name: 'triggerSystemAccessTokenReset',
    description:
      'Manually trigger the system access tokens monthly reset cron job',
  })
  async triggerSystemAccessTokenReset(): Promise<string> {
    const { resetsApplied } = await this.resetScheduler.runResetsNow();
    return `${resetsApplied} token(s) reset`;
  }
}
