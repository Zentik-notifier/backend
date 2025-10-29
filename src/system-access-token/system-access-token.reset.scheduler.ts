import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemAccessToken } from './system-access-token.entity';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  return d;
}

@Injectable()
export class SystemAccessTokenResetScheduler implements OnModuleInit {
  private readonly logger = new Logger(SystemAccessTokenResetScheduler.name);

  constructor(
    @InjectRepository(SystemAccessToken)
    private readonly systemTokenRepo: Repository<SystemAccessToken>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) { }

  async onModuleInit() {
    // Run every hour
    const cronExpr = '0 * * * *';
    const job = new CronJob(cronExpr, () => this.handleResets());
    this.schedulerRegistry.addCronJob('systemAccessTokenMonthlyReset', job);
    job.start();
    this.logger.log(`System access token monthly reset cron scheduled: ${cronExpr}`);
  }

  private getCurrentPeriodStartForToken(token: SystemAccessToken): Date {
    // Periods repeat monthly based on creation date day/time
    const created = token.createdAt;
    const now = new Date();

    // Find the latest period start that is <= now
    let periodStart = new Date(created.getTime());
    while (addMonths(periodStart, 1) <= now) {
      periodStart = addMonths(periodStart, 1);
    }
    return periodStart;
  }

  async handleResets() {
    this.logger.log('Cron started: evaluate monthly resets for system access tokens');
    try {
      // Load tokens in batches to avoid memory issues
      const batchSize = 500;
      let offset = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const tokens = await this.systemTokenRepo.find({
          order: { createdAt: 'ASC' },
          skip: offset,
          take: batchSize,
        });
        if (tokens.length === 0) break;

        for (const token of tokens) {
          const currentPeriodStart = this.getCurrentPeriodStartForToken(token);
          const lastResetAt = token.lastResetAt || token.createdAt;

          // If last reset is before the current period start, reset monthly calls
          if (lastResetAt < currentPeriodStart) {
            await this.systemTokenRepo.update({ id: token.id }, {
              calls: 0,
              lastResetAt: currentPeriodStart,
            });
            this.logger.debug(`Reset monthly calls for token ${token.id} at ${currentPeriodStart.toISOString()}`);
          }
        }

        offset += tokens.length;
        if (tokens.length < batchSize) break;
      }

      this.logger.log('Cron completed: monthly resets evaluated');
    } catch (error) {
      this.logger.error('Cron failed while resetting system access token monthly calls', error);
    }
  }
}


