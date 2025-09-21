import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseBackupService } from './database-backup.service';

@Module({
  imports: [ConfigModule],
  providers: [DatabaseBackupService],
  exports: [DatabaseBackupService],
})
export class DatabaseBackupModule {}
