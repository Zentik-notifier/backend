import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServerSetting, ServerSettingType } from '../entities/server-setting.entity';
import { BackupInfoDto, UpdateServerSettingDto, BatchUpdateSettingInput } from './dto';
import { BackupResult, ServerManagerService } from './server-manager.service';
import { ServerSettingsService } from './server-settings.service';
import { LogStorageService } from './log-storage.service';
import { LokiLoggerService } from './loki-logger.service';
import { GetLogsInput, PaginatedLogs } from './dto/get-logs.dto';
import { AdminOnlyGuard } from 'src/auth/guards/admin-only.guard';

@Resolver()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class ServerManagerResolver {
  constructor(
    private readonly serverManagerService: ServerManagerService,
    private readonly serverSettingsService: ServerSettingsService,
    private readonly logStorageService: LogStorageService,
    private readonly lokiLoggerService: LokiLoggerService,
  ) {}

  @Query(() => [BackupInfoDto], {
    name: 'listBackups',
    description: 'List all available database backups',
  })
  async listBackups(): Promise<BackupInfoDto[]> {
    return await this.serverManagerService.listBackups();
  }

  @Mutation(() => Boolean, {
    name: 'deleteBackup',
    description: 'Delete a specific backup file',
  })
  async deleteBackup(
    @Args('filename', { type: () => String }) filename: string,
  ): Promise<boolean> {
    return await this.serverManagerService.deleteBackup(filename);
  }

  @Mutation(() => String, {
    name: 'triggerBackup',
    description: 'Manually trigger a database backup',
  })
  async triggerBackup(): Promise<string> {
    const result: BackupResult =
      await this.serverManagerService.triggerBackup();

    if (result.success) {
      return `Backup created successfully: ${result.filename} (${result.size})`;
    } else {
      throw new Error(`Backup failed: ${result.error}`);
    }
  }

  // Server Settings queries and mutations
  @Query(() => [ServerSetting], {
    name: 'serverSettings',
    description: 'Get all server settings',
  })
  async getAllSettings(): Promise<ServerSetting[]> {
    return this.serverSettingsService.getAllSettings();
  }

  @Query(() => ServerSetting, {
    name: 'serverSetting',
    nullable: true,
    description: 'Get a specific server setting by type',
  })
  async getSettingByType(
    @Args('configType', { type: () => ServerSettingType })
    configType: ServerSettingType,
  ): Promise<ServerSetting | null> {
    return this.serverSettingsService.getSettingByType(configType);
  }

  @Mutation(() => ServerSetting, {
    name: 'updateServerSetting',
    description: 'Update an existing server setting',
  })
  async updateServerSetting(
    @Args('configType', { type: () => ServerSettingType })
    configType: ServerSettingType,
    @Args('input') dto: UpdateServerSettingDto,
  ): Promise<ServerSetting> {
    return this.serverSettingsService.updateSetting(configType, dto);
  }

  @Mutation(() => [ServerSetting], {
    name: 'batchUpdateServerSettings',
    description: 'Batch update multiple server settings',
  })
  async batchUpdateServerSettings(
    @Args('settings', { type: () => [BatchUpdateSettingInput] })
    settings: BatchUpdateSettingInput[],
  ): Promise<ServerSetting[]> {
    return this.serverSettingsService.batchUpdateSettings(settings);
  }

  @Mutation(() => String, {
    name: 'restartServer',
    description: 'Restart the server',
  })
  async restartServer(): Promise<string> {
    const result = await this.serverManagerService.restartServer();
    if (result.success) {
      return result.message;
    } else {
      throw new Error(result.message);
    }
  }

  // Log Storage queries
  @Query(() => PaginatedLogs, {
    name: 'logs',
    description: 'Get logs with pagination and filtering',
  })
  async getLogs(@Args('input') input: GetLogsInput): Promise<PaginatedLogs> {
    return this.logStorageService.getLogs(input);
  }

  @Query(() => Number, {
    name: 'totalLogCount',
    description: 'Get total log count',
  })
  async getTotalLogCount(): Promise<number> {
    return this.logStorageService.getTotalLogCount();
  }

  @Query(() => String, {
    name: 'logCountByLevel',
    description: 'Get log count by level',
  })
  async getLogCountByLevel(): Promise<string> {
    const counts = await this.logStorageService.getLogCountByLevel();
    return JSON.stringify(counts);
  }

  @Mutation(() => Boolean, {
    name: 'triggerLogCleanup',
    description: 'Manually trigger log cleanup based on retention policy',
  })
  async triggerLogCleanup(): Promise<boolean> {
    try {
      await this.logStorageService.cleanupOldLogs();
      return true;
    } catch (error) {
      throw new Error(`Failed to cleanup logs: ${error.message}`);
    }
  }

  @Query(() => String, {
    name: 'logCleanupCronStatus',
    description: 'Get the status of the log cleanup cron job',
  })
  async getLogCleanupCronStatus(): Promise<string> {
    const status = this.logStorageService.getCronJobStatus();
    return JSON.stringify(status);
  }

  @Mutation(() => Boolean, {
    name: 'startLogCleanupCron',
    description: 'Start the log cleanup cron job',
  })
  async startLogCleanupCron(): Promise<boolean> {
    try {
      this.logStorageService.startCronJob();
      return true;
    } catch (error) {
      throw new Error(`Failed to start cron job: ${error.message}`);
    }
  }

  @Mutation(() => Boolean, {
    name: 'stopLogCleanupCron',
    description: 'Stop the log cleanup cron job',
  })
  async stopLogCleanupCron(): Promise<boolean> {
    try {
      this.logStorageService.stopCronJob();
      return true;
    } catch (error) {
      throw new Error(`Failed to stop cron job: ${error.message}`);
    }
  }

  // Loki mutations
  @Mutation(() => Boolean, {
    name: 'flushLokiLogs',
    description: 'Force flush all pending logs to Loki',
  })
  async flushLokiLogs(): Promise<boolean> {
    try {
      await this.lokiLoggerService.forceFlush();
      return true;
    } catch (error) {
      throw new Error(`Failed to flush logs to Loki: ${error.message}`);
    }
  }

  @Mutation(() => Boolean, {
    name: 'reloadLokiConfig',
    description: 'Reload Loki configuration from settings',
  })
  async reloadLokiConfig(): Promise<boolean> {
    try {
      await this.lokiLoggerService.reloadSettings();
      return true;
    } catch (error) {
      throw new Error(`Failed to reload Loki configuration: ${error.message}`);
    }
  }
}
