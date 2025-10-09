import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Repository, LessThan, Like, FindOptionsWhere } from 'typeorm';
import { Log, LogLevel } from '../entities/log.entity';
import { ServerSettingsService } from './server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';
import { GetLogsInput, PaginatedLogs } from './dto/get-logs.dto';

@Injectable()
export class LogStorageService implements OnModuleInit {
  private readonly logger = new Logger(LogStorageService.name);
  private readonly CRON_JOB_NAME = 'logs-cleanup';

  constructor(
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
    private readonly serverSettingsService: ServerSettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Initialize and register the cron job dynamically
   */
  onModuleInit() {
    this.registerCleanupCronJob();
  }

  /**
   * Register the cleanup cron job dynamically
   */
  private registerCleanupCronJob() {
    const cronExpression = '0 */2 * * *'; // Every 2 hours at minute 0
    
    const job = new CronJob(cronExpression, () => {
      this.cleanupOldLogs();
    });

    this.schedulerRegistry.addCronJob(this.CRON_JOB_NAME, job);
    job.start();

    this.logger.log(
      `Logs cleanup cron scheduled with expression: ${cronExpression}`,
    );
  }

  /**
   * Save a log entry to the database if storage is enabled
   */
  async saveLog(
    level: LogLevel,
    message: string,
    context?: string,
    trace?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      // Check if log storage is enabled
      const storageEnabled = await this.isLogStorageEnabled();
      if (!storageEnabled) {
        return;
      }

      const log = this.logRepository.create({
        level,
        message,
        context,
        trace,
        metadata,
        timestamp: new Date(),
      });

      await this.logRepository.save(log);
    } catch (error) {
      // Don't throw errors for logging failures to avoid breaking the app
      console.error('Failed to save log to database:', error);
    }
  }

  /**
   * Get logs with pagination and filtering
   */
  async getLogs(input: GetLogsInput): Promise<PaginatedLogs> {
    const { page = 1, limit = 50, level, context, search } = input;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Log> = {};
    
    if (level) {
      where.level = level;
    }
    
    if (context) {
      where.context = context;
    }
    
    if (search) {
      where.message = Like(`%${search}%`);
    }

    const [logs, total] = await this.logRepository.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip,
      take: limit,
    });

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Clean up old logs based on retention policy
   * Called by cron job every 2 hours
   */
  async cleanupOldLogs(): Promise<void> {
    try {
      this.logger.log('Starting log cleanup cron job...');
      
      const storageEnabled = await this.isLogStorageEnabled();
      if (!storageEnabled) {
        this.logger.log('Log storage is disabled, skipping cleanup');
        return;
      }

      const retentionDays = await this.getLogRetentionDays();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      this.logger.log(
        `Cleaning up logs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`,
      );

      const result = await this.logRepository.delete({
        timestamp: LessThan(cutoffDate),
      });

      if (result.affected && result.affected > 0) {
        this.logger.log(
          `✅ Successfully cleaned up ${result.affected} log entries older than ${retentionDays} days`,
        );
      } else {
        this.logger.log('No old logs to clean up');
      }
    } catch (error) {
      this.logger.error('❌ Failed to cleanup old logs', error);
    }
  }

  /**
   * Check if log storage is enabled
   */
  private async isLogStorageEnabled(): Promise<boolean> {
    try {
      const setting = await this.serverSettingsService.getSettingByType(
        ServerSettingType.LogStorageEnabled,
      );
      return setting?.valueBool ?? false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get log retention days from settings
   */
  private async getLogRetentionDays(): Promise<number> {
    try {
      const setting = await this.serverSettingsService.getSettingByType(
        ServerSettingType.LogRetentionDays,
      );
      return setting?.valueNumber ?? 7; // Default to 7 days
    } catch (error) {
      return 7;
    }
  }

  /**
   * Get total log count
   */
  async getTotalLogCount(): Promise<number> {
    return this.logRepository.count();
  }

  /**
   * Get log count by level
   */
  async getLogCountByLevel(): Promise<Record<LogLevel, number>> {
    const counts = await this.logRepository
      .createQueryBuilder('log')
      .select('log.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.level')
      .getRawMany();

    const result: any = {};
    for (const level of Object.values(LogLevel)) {
      result[level] = 0;
    }

    counts.forEach((item) => {
      result[item.level] = parseInt(item.count, 10);
    });

    return result;
  }
}
