import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { AccessTokenService } from './access-token.service';
import {
  AccessTokenListDto,
  AccessTokenResponseDto,
  CreateAccessTokenDto,
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
}
