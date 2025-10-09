import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServerSetting, ServerSettingType } from '../entities/server-setting.entity';
import { BackupInfoDto, UpdateServerSettingDto } from './dto';
import { BackupResult, ServerManagerService } from './server-manager.service';
import { ServerSettingsService } from './server-settings.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class ServerManagerResolver {
  constructor(
    private readonly serverManagerService: ServerManagerService,
    private readonly serverSettingsService: ServerSettingsService,
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
}
