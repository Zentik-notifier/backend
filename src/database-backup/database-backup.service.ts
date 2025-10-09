import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { ServerSettingsService } from '../server-settings/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

const execAsync = promisify(exec);

export interface BackupConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  storagePath: string;
  maxToKeep: number;
  compressBackup: boolean;
}

export interface BackupResult {
  success: boolean;
  filename?: string;
  size?: string;
  error?: string;
  timestamp: Date;
}

@Injectable()
export class DatabaseBackupService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBackupService.name);
  private config: BackupConfig;

  constructor(
    private configService: ConfigService,
    private serverSettingsService: ServerSettingsService,
    private schedulerRegistry: SchedulerRegistry,
  ) {
    // Config will be initialized in onModuleInit
    this.config = {
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      database: this.configService.get<string>('DB_NAME', 'zentik'),
      username: this.configService.get<string>('DB_USERNAME', 'zentik_user'),
      password: this.configService.get<string>(
        'DB_PASSWORD',
        'zentik_password',
      ),
      storagePath: '/var/backups/zentik', // Will be updated in onModuleInit
      maxToKeep: 10, // Will be updated in onModuleInit
      compressBackup: true,
    };
  }

  async onModuleInit() {
    // Load backup configuration from ServerSettings
    const storagePath = (await this.serverSettingsService.getSettingByType(ServerSettingType.BackupStoragePath))?.valueText 
      || this.configService.get<string>('BACKUP_STORAGE_PATH') 
      || '/var/backups/zentik';
    const maxToKeep = (await this.serverSettingsService.getSettingByType(ServerSettingType.BackupMaxToKeep))?.valueNumber 
      || this.configService.get<number>('BACKUP_MAX_TO_KEEP') 
      || 10;
    
    // Update config with ServerSettings values
    this.config.storagePath = storagePath;
    this.config.maxToKeep = maxToKeep;
    
    // Ensure backup directory exists with updated path
    this.ensureBackupDirectory();
    
    const backupEnabled =
      (await this.serverSettingsService.getSettingByType(ServerSettingType.BackupEnabled))?.valueBool ?? false;

    if (!backupEnabled) {
      this.logger.log('Database backup disabled');
      return;
    }

    // Execute backup on startup if configured
    const executeOnStartSetting = await this.serverSettingsService.getSettingByType(ServerSettingType.BackupExecuteOnStart);
    const executeOnStart = executeOnStartSetting?.valueBool 
      ?? ((this.configService.get<string>('BACKUP_EXECUTE_ON_START') === 'true') || true);
    if (executeOnStart) {
      this.logger.log('Executing initial database backup on startup...');
      this.handleBackup().catch((error) => {
        this.logger.error(`Initial backup failed: ${error.message}`);
      });
    }

    // Single backup cron job
    const cronExpr =
      (await this.serverSettingsService.getSettingByType(ServerSettingType.BackupCronJob))?.valueText || '0 */12 * * *';
    const backupJob = new CronJob(cronExpr, () => this.handleBackup());
    this.schedulerRegistry.addCronJob('databaseBackup', backupJob);
    backupJob.start();
    this.logger.log(
      `Database backup cron scheduled with expression: ${cronExpr}`,
    );
  }

  /**
   * Cron job that runs database backup
   */
  async handleBackup(): Promise<void> {
    this.logger.log('Starting scheduled database backup');
    const result = await this.createBackup();

    if (result.success) {
      this.logger.log(
        `Database backup completed successfully: ${result.filename} (${result.size})`,
      );
    } else {
      this.logger.error(`Database backup failed: ${result.error}`);
    }
  }

  /**
   * Create a database backup
   */
  private async createBackup(): Promise<BackupResult> {
    const timestamp = new Date();
    const timestampStr = timestamp
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    const baseFilename = `zentik_backup_${timestampStr}`;
    const sqlFilename = `${baseFilename}.sql`;
    const finalFilename = `${sqlFilename}.gz`;
    const backupPath = path.join(this.config.storagePath, sqlFilename);

    try {
      // Set PGPASSWORD environment variable for non-interactive backup
      const env = {
        ...process.env,
        PGPASSWORD: this.config.password,
      };

      // Build pg_dump command with output file
      const pgDumpCommand = [
        'pg_dump',
        `-h ${this.config.host}`,
        `-p ${this.config.port}`,
        `-U ${this.config.username}`,
        `-d ${this.config.database}`,
        '--verbose',
        '--no-password',
        '--format=plain',
        '--no-owner',
        '--no-privileges',
        '--clean',
        '--if-exists',
        `-f "${backupPath}"`,
      ].join(' ');

      this.logger.debug(`Executing backup command: ${pgDumpCommand}`);

      // Execute backup
      const { stderr } = await execAsync(pgDumpCommand, {
        env,
        cwd: this.config.storagePath,
      });

      if (stderr && !stderr.includes('pg_dump: ')) {
        throw new Error(`pg_dump error: ${stderr}`);
      }

      // Verify backup file was created
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file was not created');
      }

      // Always compress backup
      this.logger.debug('Compressing backup...');
      const compressCommand = `gzip "${backupPath}"`;
      await execAsync(compressCommand);

      // Get final backup path and size
      const finalBackupPath = `${backupPath}.gz`;
      const stats = fs.statSync(finalBackupPath);
      const size = this.formatBytes(stats.size);

      this.logger.log(
        `Backup created successfully: ${finalFilename} (${size})`,
      );

      // Clean up old backups
      await this.cleanupOldBackups();

      return {
        success: true,
        filename: finalFilename,
        size,
        timestamp,
      };
    } catch (error) {
      this.logger.error(`Backup failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp,
      };
    }
  }

  /**
   * Clean up old backup files keeping only the most recent ones
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = fs.readdirSync(this.config.storagePath);
      const backupFiles: Array<{
        filename: string;
        path: string;
        mtime: Date;
      }> = [];

      // Collect all backup files with their metadata
      for (const file of files) {
        if (
          file.startsWith('zentik_backup_') &&
          (file.endsWith('.sql') || file.endsWith('.sql.gz'))
        ) {
          const filePath = path.join(this.config.storagePath, file);
          const stats = fs.statSync(filePath);

          backupFiles.push({
            filename: file,
            path: filePath,
            mtime: stats.mtime,
          });
        }
      }

      // Sort by modification time (newest first)
      backupFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Delete files beyond maxToKeep
      if (backupFiles.length > this.config.maxToKeep) {
        const filesToDelete = backupFiles.slice(this.config.maxToKeep);
        let deletedCount = 0;

        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          deletedCount++;
          this.logger.debug(`Deleted old backup: ${file.filename}`);
        }

        if (deletedCount > 0) {
          this.logger.log(
            `Cleaned up ${deletedCount} old backup files (keeping ${this.config.maxToKeep} most recent)`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup old backups: ${error.message}`);
    }
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    try {
      if (!fs.existsSync(this.config.storagePath)) {
        fs.mkdirSync(this.config.storagePath, { recursive: true });
        this.logger.log(`Created backup directory: ${this.config.storagePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create backup directory: ${error.message}`);
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
