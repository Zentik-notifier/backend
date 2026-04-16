import { UseGuards } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from './guards/admin-only.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionCleanupScheduler } from './session-cleanup.scheduler';

@Resolver()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class SessionCronResolver {
  constructor(
    private readonly sessionCleanupScheduler: SessionCleanupScheduler,
  ) {}

  @Mutation(() => String, {
    name: 'triggerSessionsCleanup',
    description:
      'Manually trigger the sessions cleanup cron job (deletes sessions with lastActivity older than 14 days)',
  })
  async triggerSessionsCleanup(): Promise<string> {
    const { deletedSessions } =
      await this.sessionCleanupScheduler.runCleanupNow();
    return `Deleted ${deletedSessions} session(s)`;
  }
}
