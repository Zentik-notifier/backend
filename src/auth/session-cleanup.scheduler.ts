import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionService } from './session.service';

@Injectable()
export class SessionCleanupScheduler {
  private readonly logger = new Logger(SessionCleanupScheduler.name);

  constructor(private readonly sessionService: SessionService) {}

  // Run every day at 03:15
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyCleanup() {
    try {
      // Add a small offset to not clash with other 03:00 jobs
      await new Promise((r) => setTimeout(r, 15 * 60 * 1000));
    } catch {}

    try {
      await this.runCleanupNow();
    } catch (error) {
      this.logger.warn(`Failed to cleanup old sessions: ${error?.message}`);
    }
  }

  async runCleanupNow(): Promise<{ deletedSessions: number }> {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days
    const deleted = await this.sessionService.deleteSessionsOlderThan(cutoff);
    if (deleted > 0) {
      this.logger.log(
        `🧹 Deleted ${deleted} sessions older than 14 days (lastActivity)`,
      );
    } else {
      this.logger.debug('🧹 No sessions to delete during this run');
    }
    return { deletedSessions: deleted };
  }
}


