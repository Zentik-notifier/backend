import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { MessagesService } from './messages.service';

@Injectable()
export class MessagesCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(MessagesCleanupScheduler.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) { }

  onModuleInit() {
    const cleanupJobsEnabled = this.configService.get<string>('MESSAGES_DELETE_JOB_ENABLED') !== 'false';

    if (!cleanupJobsEnabled) {
      this.logger.log('Messages cleanup cron disabled');
      return;
    }

    const cronExpr =
      this.configService.get<string>('MESSAGES_DELETE_CRON_JOB') ||
      '0 0 * * * *';
    // const cronExpr = '* * * * *';
    const job = new CronJob(cronExpr, () => this.handleCleanup());
    this.schedulerRegistry.addCronJob('messagesCleanup', job);
    job.start();
    this.logger.log(
      `Messages cleanup cron scheduled with expression: ${cronExpr}`,
    );
  }

  async handleCleanup() {
    this.logger.log('Cron started: delete fully-read messages');
    try {
      const { deletedMessages } =
        await this.messagesService.deleteMessagesFullyRead();
      this.logger.log(`Cron completed: deleted ${deletedMessages} message(s)`);
    } catch (error) {
      this.logger.error('Cron failed', error);
    }
  }
}
