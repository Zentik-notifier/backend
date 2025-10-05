import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { SystemAccessTokenDto } from './dto';
import { SystemAccessTokenService } from './system-access-token.service';

@Resolver()
@UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
@Injectable()
export class SystemAccessTokenResolver {
  constructor(private readonly service: SystemAccessTokenService) {}

  @Mutation(() => SystemAccessTokenDto)
  async createSystemToken(
    @Args('maxCalls') maxCalls: number,
    @Args('expiresAt', { nullable: true }) expiresAt?: string,
    @Args('requesterId', { nullable: true }) requesterId?: string,
    @Args('description', { nullable: true }) description?: string,
  ) {
    return await this.service.createToken(
      maxCalls,
      expiresAt ? new Date(expiresAt) : undefined,
      requesterId,
      description,
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
  ) {
    return await this.service.updateToken(
      id,
      maxCalls,
      expiresAt ? new Date(expiresAt) : undefined,
      requesterId,
      description,
    );
  }

  @Mutation(() => Boolean)
  async revokeSystemToken(@Args('id') id: string) {
    return await this.service.revoke(id);
  }
}
