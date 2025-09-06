import { Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { OAuthProvider } from '../entities';
import {
  CreateOAuthProviderDto,
  OAuthProviderPublicDto,
  UpdateOAuthProviderDto,
} from './dto';
import { OAuthProvidersService } from './oauth-providers.service';

@Resolver(() => OAuthProvider)
export class OAuthProvidersResolver {
  private readonly logger = new Logger(OAuthProvidersResolver.name);

  constructor(private readonly oauthProvidersService: OAuthProvidersService) {}

  @Query(() => [OAuthProviderPublicDto], { name: 'enabledOAuthProviders' })
  async findEnabledProviders(): Promise<OAuthProviderPublicDto[]> {
    return this.oauthProvidersService.findEnabledProvidersPublic();
  }

  @Query(() => [OAuthProvider], { name: 'allOAuthProviders' })
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async findAllProviders(): Promise<OAuthProvider[]> {
    return this.oauthProvidersService.findAll();
  }

  @Query(() => OAuthProvider, { name: 'oauthProvider' })
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async findOneProvider(@Args('id') id: string): Promise<OAuthProvider> {
    return this.oauthProvidersService.findOne(id);
  }

  @Mutation(() => OAuthProvider)
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async createOAuthProvider(
    @Args('input') createOAuthProviderDto: CreateOAuthProviderDto,
  ): Promise<OAuthProvider> {
    return this.oauthProvidersService.create(createOAuthProviderDto);
  }

  @Mutation(() => OAuthProvider)
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async updateOAuthProvider(
    @Args('id') id: string,
    @Args('input') updateOAuthProviderDto: UpdateOAuthProviderDto,
  ): Promise<OAuthProvider> {
    return this.oauthProvidersService.update(id, updateOAuthProviderDto);
  }

  @Mutation(() => OAuthProvider)
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async toggleOAuthProvider(@Args('id') id: string): Promise<OAuthProvider> {
    return this.oauthProvidersService.toggleEnabled(id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  async deleteOAuthProvider(@Args('id') id: string): Promise<boolean> {
    await this.oauthProvidersService.remove(id);
    return true;
  }
}
