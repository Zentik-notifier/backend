import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseBackupService } from './database-backup.service';
import { ServerSettingsModule } from '../server-settings/server-settings.module';

@Module({
  imports: [ConfigModule, ServerSettingsModule],
  providers: [DatabaseBackupService],
  exports: [DatabaseBackupService],
})
export class DatabaseBackupModule {}
