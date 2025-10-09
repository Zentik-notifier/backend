import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, LessThan, Like, FindOptionsWhere } from 'typeorm';
import { Log, LogLevel } from '../entities/log.entity';
import { ServerSettingsService } from './server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';
import { GetLogsInput, PaginatedLogs } from './dto/get-logs.dto';

@Injectable()
export class LogStorageService {
  private readonly logger = new Logger(LogStorageService.name);

  constructor(
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
    private readonly serverSettingsService: ServerSettingsService,
  ) {}

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
   * Runs every day at 2 AM
   */
  @Cron(CronExpression.EVERY_2ND_HOUR)
  async cleanupOldLogs(): Promise<void> {
    try {
      const storageEnabled = await this.isLogStorageEnabled();
      if (!storageEnabled) {
        return;
      }

      const retentionDays = await this.getLogRetentionDays();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.logRepository.delete({
        timestamp: LessThan(cutoffDate),
      });

      if (result.affected && result.affected > 0) {
        this.logger.log(
          `Cleaned up ${result.affected} log entries older than ${retentionDays} days`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old logs', error);
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
