import { Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from './decorators/current-user.decorator';
import { SessionInfoDto } from './dto/session.dto';
import { JwtOrAccessTokenGuard } from './guards/jwt-or-access-token.guard';
import { SessionService } from './session.service';

@Resolver()
@UseGuards(JwtOrAccessTokenGuard)
export class SessionResolver {
  private readonly logger = new Logger(SessionResolver.name);

  constructor(private readonly sessionService: SessionService) {}

  @Query(() => [SessionInfoDto])
  async getUserSessions(
    @CurrentUser('id') userId: string,
    @CurrentUser('tokenId') currentTokenId?: string,
  ): Promise<SessionInfoDto[]> {
    const sessions = await this.sessionService.getUserSessions(
      userId,
      currentTokenId,
    );
    return sessions;
  }

  @Mutation(() => Boolean)
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Args('sessionId') sessionId: string,
  ): Promise<boolean> {
    const result = await this.sessionService.revokeSession(userId, sessionId);
    return result;
  }

  @Mutation(() => Boolean)
  async revokeAllOtherSessions(
    @CurrentUser('id') userId: string,
    @CurrentUser('tokenId') currentTokenId?: string,
  ): Promise<boolean> {
    const result = await this.sessionService.revokeAllSessions(
      userId,
      currentTokenId,
    );
    return result;
  }
}
