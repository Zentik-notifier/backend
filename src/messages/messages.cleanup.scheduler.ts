import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { MessagesService } from './messages.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

@Injectable()
export class MessagesCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(MessagesCleanupScheduler.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly serverSettingsService: ServerSettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) { }

  async onModuleInit() {
    const cleanupJobsEnabled =
      (await this.serverSettingsService.getSettingByType(ServerSettingType.MessagesDeleteJobEnabled))?.valueBool ?? true;

    if (!cleanupJobsEnabled) {
      this.logger.log('Messages cleanup cron disabled');
      return;
    }

    const cronExpr = '0 0 * * * *';
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
