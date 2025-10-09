import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AttachmentsService } from './attachments.service';
import { ServerSettingsService } from '../server-settings/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

@Injectable()
export class AttachmentsCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(AttachmentsCleanupScheduler.name);

  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly serverSettingsService: ServerSettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    const cleanupJobsEnabled =
      (await this.serverSettingsService.getSettingByType(ServerSettingType.AttachmentsDeleteJobEnabled))?.valueBool ?? true;

    if (!cleanupJobsEnabled) {
      this.logger.log('Attachments cleanup cron disabled');
      return;
    }

    const cronExpr =
      (await this.serverSettingsService.getSettingByType(ServerSettingType.AttachmentsDeleteCronJob))?.valueText ||
      '0 0 * * * *';
    const job = new CronJob(cronExpr, () => this.handleCleanup());
    this.schedulerRegistry.addCronJob('attachmentsCleanup', job);
    job.start();
    this.logger.log(
      `Attachments cleanup cron scheduled with expression: ${cronExpr}`,
    );
  }

  async handleCleanup() {
    this.logger.log('Cron started: delete old attachments');
    try {
      const maxAgeInput =
        (await this.serverSettingsService.getSettingByType(ServerSettingType.AttachmentsMaxAge))?.valueText || '0';
      const maxAgeMs = this.parseDurationToMs(maxAgeInput);
      if (!maxAgeMs || maxAgeMs <= 0) {
        this.logger.log(
          'Skipping attachments cleanup: ATTACHMENTS_MAX_AGE not configured or <= 0',
        );
        return;
      }
      const { deletedAttachments } =
        await this.attachmentsService.deleteAttachmentsOlderThan(maxAgeMs);
      this.logger.log(
        `Cron completed: deleted ${deletedAttachments} attachment(s)`,
      );
    } catch (error) {
      this.logger.error('Attachments cleanup cron failed', error);
    }
  }

  private parseDurationToMs(input: string): number {
    if (!input) return 0;
    if (/^\d+$/.test(input)) {
      const seconds = parseInt(input, 10);
      return seconds * 1000;
    }
    const match = input.match(/^(\d+)(ms|s|m|h|d)$/i);
    if (!match) return 0;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }
}
