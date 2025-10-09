import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupInfoDto } from './dto';
import { BackupResult, ServerManagerService } from './server-manager.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class ServerManagerResolver {
  constructor(private readonly serverManagerService: ServerManagerService) {}

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
    const result: BackupResult = await this.serverManagerService.triggerBackup();
    
    if (result.success) {
      return `Backup created successfully: ${result.filename} (${result.size})`;
    } else {
      throw new Error(`Backup failed: ${result.error}`);
    }
  }
}
