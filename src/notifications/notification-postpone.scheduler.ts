import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { NotificationPostponeService } from './notification-postpone.service';

@Injectable()
export class NotificationPostponeScheduler implements OnModuleInit {
  private readonly logger = new Logger(NotificationPostponeScheduler.name);

  constructor(
    private readonly postponeService: NotificationPostponeService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    // Run every minute to check for postponed notifications ready to send
    const cronExpr = '*/1 * * * *';
    const job = new CronJob(cronExpr, () => this.handlePostpones());
    this.schedulerRegistry.addCronJob('notificationPostpones', job);
    job.start();
    this.logger.log(
      `Notification postpone cron scheduled with expression: ${cronExpr}`,
    );
  }

  async handlePostpones() {
    try {
      const result = await this.postponeService.processReadyPostpones();
      
      if (result.processed > 0) {
        this.logger.log(
          `Postpone cron completed: processed ${result.processed}, succeeded ${result.succeeded}, failed ${result.failed}`,
        );
      }
    } catch (error) {
      this.logger.error('Postpone cron failed', error);
    }
  }
}
