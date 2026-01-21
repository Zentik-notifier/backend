import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { AccessTokenService } from './access-token.service';
import {
  AccessTokenListDto,
  AccessTokenResponseDto,
  CreateAccessTokenDto,
  UpdateAccessTokenDto,
} from './dto/auth.dto';
import { JwtOrAccessTokenGuard } from './guards/jwt-or-access-token.guard';

@Resolver()
@UseGuards(JwtOrAccessTokenGuard)
export class AccessTokenResolver {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  @Mutation(() => AccessTokenResponseDto)
  async createAccessToken(
    @CurrentUser('id') userId: string,
    @Args('input') createDto: CreateAccessTokenDto,
  ): Promise<AccessTokenResponseDto> {
    return this.accessTokenService.createAccessToken(userId, createDto);
  }

  @Query(() => [AccessTokenListDto])
  async getUserAccessTokens(
    @CurrentUser('id') userId: string,
  ): Promise<AccessTokenListDto[]> {
    return this.accessTokenService.getUserAccessTokens(userId);
  }

  @Query(() => AccessTokenListDto)
  async getAccessToken(
    @CurrentUser('id') userId: string,
    @Args('tokenId') tokenId: string,
  ): Promise<AccessTokenListDto> {
    return this.accessTokenService.getAccessToken(userId, tokenId);
  }

  @Query(() => [AccessTokenListDto])
  async getAccessTokensForBucket(
    @CurrentUser('id') userId: string,
    @Args('bucketId') bucketId: string,
  ): Promise<AccessTokenListDto[]> {
    return this.accessTokenService.getAccessTokensForBucket(userId, bucketId);
  }

  @Mutation(() => AccessTokenResponseDto)
  async createAccessTokenForBucket(
    @CurrentUser('id') userId: string,
    @Args('bucketId') bucketId: string,
    @Args('name') name: string,
  ): Promise<AccessTokenResponseDto> {
    return this.accessTokenService.createAccessTokenForBucket(userId, bucketId, name);
  }

  @Mutation(() => AccessTokenListDto)
  async updateAccessToken(
    @CurrentUser('id') userId: string,
    @Args('tokenId') tokenId: string,
    @Args('input') updateDto: UpdateAccessTokenDto,
  ): Promise<AccessTokenListDto> {
    return this.accessTokenService.updateAccessToken(userId, tokenId, updateDto);
  }

  @Mutation(() => Boolean)
  async revokeAccessToken(
    @CurrentUser('id') userId: string,
    @Args('tokenId') tokenId: string,
  ): Promise<boolean> {
    return this.accessTokenService.revokeAccessToken(userId, tokenId);
  }

  @Mutation(() => Boolean)
  async revokeAllAccessTokens(
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    return this.accessTokenService.revokeAllAccessTokens(userId);
  }

  @Mutation(() => AccessTokenResponseDto)
  async createOrRegenerateWatchToken(
    @CurrentUser('id') userId: string,
  ): Promise<AccessTokenResponseDto> {
    return this.accessTokenService.createOrRegenerateWatchToken(userId);
  }

  @Query(() => AccessTokenListDto, { nullable: true })
  async getWatchToken(
    @CurrentUser('id') userId: string,
  ): Promise<AccessTokenListDto | null> {
    return this.accessTokenService.getWatchToken(userId);
  }

  @Mutation(() => Boolean)
  async deleteWatchToken(
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    return this.accessTokenService.deleteWatchToken(userId);
  }
}
