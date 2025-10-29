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

    const now = new Date();
    const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days
    try {
      const deleted = await this.sessionService.deleteSessionsOlderThan(cutoff);
      if (deleted > 0) {
        this.logger.log(`🧹 Deleted ${deleted} sessions older than 14 days (lastActivity)`);
      } else {
        this.logger.debug('🧹 No sessions to delete during this run');
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup old sessions: ${error?.message}`);
    }
  }
}


