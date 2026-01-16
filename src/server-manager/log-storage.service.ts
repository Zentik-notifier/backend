import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import * as path from 'path';
import * as fs from 'fs';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { v4 as uuidv4 } from 'uuid';
import { LogLevel } from '../entities/log-level.enum';
import { ServerSettingsService } from './server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';
import { GetLogsInput, PaginatedLogs, Log } from './dto/get-logs.dto';

@Injectable()
export class LogStorageService implements OnModuleInit {
  private readonly logger = new Logger(LogStorageService.name);
  private readonly CRON_JOB_NAME = 'logs-cleanup';
  private logsDirectory: string;
  private winstonLogger: winston.Logger;
  private initPromise: Promise<void>;
  private loggingDisabled = false;

  constructor(
    private readonly serverSettingsService: ServerSettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.initPromise = this.initializeLogsDirectory();
  }

  /**
   * Initialize logs directory and Winston logger from settings
   */
  private async initializeLogsDirectory(): Promise<void> {
    // Check if file system logging is enabled
    const storeLogsOnFs = await this.serverSettingsService.getBooleanValue(
      ServerSettingType.StoreLogsOnFs,
      false,
    );

    if (!storeLogsOnFs) {
      // File system logging is disabled - create a dummy logger without file transport
      this.loggingDisabled = true;
      this.winstonLogger = winston.createLogger({
        level: 'silly',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
        transports: [], // No transports - logging disabled
      });
      this.logger.log('File system logging is disabled (StoreLogsOnFs = false)');
      return;
    }

    try {
      const logsDir = await this.serverSettingsService.getStringValue(
        ServerSettingType.LogStorageDirectory,
        path.join(process.cwd(), 'logs'),
      );
      this.logsDirectory = logsDir || path.join(process.cwd(), 'logs');

      // Create directory if it doesn't exist
      await fs.promises.mkdir(this.logsDirectory, { recursive: true });

      const retentionDays = await this.getLogRetentionDays();

      // Initialize Winston with daily rotate file transport
      // Set level to 'silly' to capture all log levels including debug
      const dailyRotateTransport = new DailyRotateFile({
        dirname: this.logsDirectory,
        filename: '%DATE%.json',
        datePattern: 'YYYY-MM-DD',
        maxFiles: `${retentionDays}d`,
        zippedArchive: false,
        format: winston.format.json(),
      });

      // Handle errors from the transport (e.g., disk full)
      dailyRotateTransport.on('error', (error: any) => {
        if (error.code === 'ENOSPC') {
          // Disk full - disable logging to prevent crash
          this.loggingDisabled = true;
          this.logger.error(
            'Disk full detected (ENOSPC). File logging has been disabled to prevent application crash.',
          );
          // Remove the transport to stop further write attempts
          this.winstonLogger.remove(dailyRotateTransport);
        } else {
          // Other errors - log but don't disable
          this.logger.error('Error in file logging transport:', error);
        }
      });

      this.winstonLogger = winston.createLogger({
        level: 'silly',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
        transports: [dailyRotateTransport],
      });

      this.logger.log(
        `Logs directory initialized: ${this.logsDirectory} (retention: ${retentionDays} days)`,
      );
    } catch (error) {
      this.logsDirectory = path.join(process.cwd(), 'logs');
      await fs.promises.mkdir(this.logsDirectory, { recursive: true });

      // Fallback Winston logger with default 30 days retention
      const fallbackDailyRotateTransport = new DailyRotateFile({
        dirname: this.logsDirectory,
        filename: '%DATE%.json',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
        zippedArchive: false,
        format: winston.format.json(),
      });

      // Handle errors from the transport (e.g., disk full)
      fallbackDailyRotateTransport.on('error', (error: any) => {
        if (error.code === 'ENOSPC') {
          // Disk full - disable logging to prevent crash
          this.loggingDisabled = true;
          this.logger.error(
            'Disk full detected (ENOSPC). File logging has been disabled to prevent application crash.',
          );
          // Remove the transport to stop further write attempts
          this.winstonLogger.remove(fallbackDailyRotateTransport);
        } else {
          // Other errors - log but don't disable
          this.logger.error('Error in file logging transport:', error);
        }
      });

      this.winstonLogger = winston.createLogger({
        level: 'silly',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
        transports: [fallbackDailyRotateTransport],
      });

      this.logger.warn(
        `Failed to load logs directory from settings, using default: ${this.logsDirectory}`,
      );
    }
  }

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
      this.cleanupOldLogsTask();
    });

    this.schedulerRegistry.addCronJob(this.CRON_JOB_NAME, job);
    job.start();

    this.logger.log(
      `Logs cleanup cron scheduled with expression: ${cronExpression}`,
    );
  }

  /**
   * Format date as YYYY-MM-DD for file names
   */
  private formatDateForFileName(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Save a log entry using Winston (thread-safe with automatic file rotation)
   */
  async saveLog(
    level: LogLevel,
    message: string,
    context?: string,
    trace?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      // Skip logging if disabled due to disk full
      if (this.loggingDisabled) {
        return;
      }

      // Wait for initialization
      await this.initPromise;

      const logEntry = {
        id: uuidv4(),
        level,
        message,
        context,
        trace,
        metadata,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      // Winston handles file locking, rotation, and concurrency automatically
      this.winstonLogger.log(level, logEntry);
    } catch (error) {
      // Check if it's a disk full error
      if (error.code === 'ENOSPC') {
        this.loggingDisabled = true;
        this.logger.error(
          'Disk full detected (ENOSPC). File logging has been disabled to prevent application crash.',
        );
        // Remove all transports to stop further write attempts
        this.winstonLogger.clear();
        return;
      }
      // Don't throw errors for logging failures to avoid breaking the app
      this.logger.error('Failed to save log:', error);
    }
  }

  /**
   * Read all log files and parse logs
   */
  private async readAllLogs(): Promise<Log[]> {
    try {
      await this.initPromise;

      const files = await fs.promises.readdir(this.logsDirectory);
      const logFiles = files
        .filter((file) => {
          // Only include YYYY-MM-DD.json files, exclude audit and hidden files
          return file.endsWith('.json') &&
            !file.startsWith('.') &&
            /^\d{4}-\d{2}-\d{2}\.json$/.test(file);
        })
        .sort()
        .reverse(); // Newest first

      const allLogs: Log[] = [];

      for (const file of logFiles) {
        try {
          const filePath = path.join(this.logsDirectory, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');

          // Winston writes one JSON object per line
          const lines = content.trim().split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const logEntry = JSON.parse(line);

              // Winston format: { level, message: logEntry, timestamp }
              // Extract our log structure from Winston's message field
              const log: Log = {
                id: logEntry.message?.id || logEntry.id || uuidv4(),
                level:
                  logEntry.message?.level || logEntry.level || LogLevel.INFO,
                message: logEntry.message?.message || logEntry.message || '',
                context: logEntry.message?.context || logEntry.context,
                trace: logEntry.message?.trace || logEntry.trace,
                metadata: logEntry.message?.metadata || logEntry.metadata,
                timestamp: new Date(
                  logEntry.message?.timestamp ||
                  logEntry.timestamp ||
                  new Date(),
                ),
                createdAt: new Date(
                  logEntry.message?.createdAt ||
                  logEntry.createdAt ||
                  new Date(),
                ),
              };

              allLogs.push(log);
            } catch (parseError) {
              this.logger.warn(
                `Failed to parse log line in ${file}: ${parseError.message}`,
              );
            }
          }
        } catch (fileError) {
          this.logger.warn(`Failed to read log file ${file}:`, fileError);
        }
      }

      return allLogs;
    } catch (error) {
      this.logger.error('Failed to read all logs:', error);
      return [];
    }
  }

  /**
   * Get logs with pagination and filtering
   */
  async getLogs(input: GetLogsInput): Promise<PaginatedLogs> {
    const { page = 1, limit = 50, level, context, search } = input;

    try {
      // Read all log files
      const allLogs = await this.readAllLogs();

      // Apply filters
      let filteredLogs = allLogs;

      if (level) {
        filteredLogs = filteredLogs.filter((log) => log.level === level);
      }

      if (context) {
        filteredLogs = filteredLogs.filter((log) => log.context === context);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        const containsSearch = (value: unknown): boolean =>
          typeof value === 'string' &&
          value.toLowerCase().includes(searchLower);

        filteredLogs = filteredLogs.filter(
          (log) =>
            containsSearch(log.message) ||
            containsSearch(log.context) ||
            containsSearch(log.trace),
        );
      }

      // Sort by timestamp descending (newest first)
      filteredLogs.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // Pagination
      const total = filteredLogs.length;
      const totalPages = Math.ceil(total / limit);
      const skip = (page - 1) * limit;
      const paginatedLogs = filteredLogs.slice(skip, skip + limit);

      return {
        logs: paginatedLogs,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to get logs:', error);
      return {
        logs: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }
  }

  /**
   * Clean up old logs based on retention policy (public method for manual cleanup)
   * Reads retention days from settings
   */
  async cleanupOldLogs(): Promise<void> {
    // Check if file system logging is enabled
    const storeLogsOnFs = await this.serverSettingsService.getBooleanValue(
      ServerSettingType.StoreLogsOnFs,
      false,
    );

    if (!storeLogsOnFs || this.loggingDisabled) {
      // File system logging is disabled - skip cleanup
      this.logger.log('Skipping log cleanup - file system logging is disabled');
      return;
    }

    try {
      const retentionDays = await this.getLogRetentionDays();

      this.logger.log(`Cleaning up logs older than ${retentionDays} days`);

      const deletedCount = await this.performCleanup(retentionDays);

      if (deletedCount > 0) {
        this.logger.log(
          `✅ Successfully cleaned up ${deletedCount} log file(s) older than ${retentionDays} days`,
        );
      } else {
        this.logger.log('No old logs to clean up');
      }
    } catch (error) {
      this.logger.error('❌ Failed to cleanup old logs', error);
      throw error;
    }
  }

  /**
   * Clean up old logs based on retention policy
   * Called by cron job every 2 hours
   */
  async cleanupOldLogsTask(): Promise<void> {
    // Check if file system logging is enabled
    const storeLogsOnFs = await this.serverSettingsService.getBooleanValue(
      ServerSettingType.StoreLogsOnFs,
      false,
    );

    if (!storeLogsOnFs || this.loggingDisabled) {
      // File system logging is disabled - skip cleanup
      return;
    }

    try {
      this.logger.log('Starting log cleanup cron job...');
      await this.cleanupOldLogs();
    } catch (error) {
      this.logger.error('❌ Failed to cleanup old logs', error);
    }
  }

  /**
   * Perform the actual cleanup of old log files
   * Note: Winston's DailyRotateFile already handles this via maxFiles,
   * but we keep this for manual cleanup and compatibility
   */
  private async performCleanup(retentionDays: number): Promise<number> {
    try {
      await this.initPromise;

      const files = await fs.promises.readdir(this.logsDirectory);
      const logFiles = files.filter((file) => {
        // Only include YYYY-MM-DD.json files, exclude audit and hidden files
        return file.endsWith('.json') &&
          !file.startsWith('.') &&
          /^\d{4}-\d{2}-\d{2}\.json$/.test(file);
      });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      cutoffDate.setHours(0, 0, 0, 0);

      let deletedCount = 0;

      for (const file of logFiles) {
        // Extract date from filename (YYYY-MM-DD.json)
        const dateMatch = file.match(/^(\d{4})-(\d{2})-(\d{2})\.json$/);

        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          const fileDate = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
          );

          if (fileDate < cutoffDate) {
            const filePath = path.join(this.logsDirectory, file);
            await fs.promises.unlink(filePath);
            deletedCount++;
            this.logger.log(`Deleted old log file: ${file}`);
          }
        }
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old logs:', error);
      return 0;
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
      return setting?.valueNumber ?? 30; // Default to 30 days
    } catch (error) {
      return 30;
    }
  }

  /**
   * Get total log count
   */
  async getTotalLogCount(): Promise<number> {
    try {
      const allLogs = await this.readAllLogs();
      return allLogs.length;
    } catch (error) {
      this.logger.error('Failed to get total log count:', error);
      return 0;
    }
  }
}
