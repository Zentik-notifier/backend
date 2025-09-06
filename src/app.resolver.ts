import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { AppService } from './app.service';
import { JwtOrAccessTokenGuard } from './auth/guards/jwt-or-access-token.guard';

@Resolver()
export class AppResolver {
  constructor(private readonly appService: AppService) {}

  @Query(() => String)
  healthcheck() {
    return 'ok';
  }

  @Query(() => String)
  @UseGuards(JwtOrAccessTokenGuard)
  async getBackendVersion() {
    return this.appService.getVersion();
  }
}
