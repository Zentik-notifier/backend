import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ServerSetting } from '../entities/server-setting.entity';
import { Log } from '../entities/log.entity';
import { ServerManagerService } from './server-manager.service';
import { ServerManagerResolver } from './server-manager.resolver';
import { ServerManagerController } from './server-manager.controller';
import { ServerSettingsService } from './server-settings.service';
import { LogStorageService } from './log-storage.service';
import { LokiLoggerService } from './loki-logger.service';
import { DatabaseLoggerService } from './database-logger.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ServerSetting, Log]),
    forwardRef(() => AuthModule),
  ],
  controllers: [ServerManagerController],
  providers: [
    ServerManagerService,
    ServerManagerResolver,
    ServerSettingsService,
    LogStorageService,
    LokiLoggerService,
    DatabaseLoggerService,
  ],
  exports: [
    ServerManagerService,
    ServerSettingsService,
    LogStorageService,
    LokiLoggerService,
    DatabaseLoggerService,
  ],
})
export class ServerManagerModule {}
