import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AuthModule } from '../auth/auth.module';
import { SystemAccessTokenModule } from '../system-access-token/system-access-token.module';
import { ServerSetting } from '../entities/server-setting.entity';
import { Log } from '../entities/log.entity';
import { ServerManagerService } from './server-manager.service';
import { ServerManagerResolver } from './server-manager.resolver';
import { ServerManagerController } from './server-manager.controller';
import { ServerSettingsService } from './server-settings.service';
import { LogStorageService } from './log-storage.service';
import { LokiLoggerService } from './loki-logger.service';
import { DatabaseLoggerService } from './database-logger.service';
import { PrometheusService } from './prometheus.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ServerSetting, Log]),
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'zentik_',
        },
      },
      defaultLabels: {
        app: 'zentik-notifier',
      },
    }),
    forwardRef(() => AuthModule),
    forwardRef(() => SystemAccessTokenModule),
  ],
  controllers: [ServerManagerController],
  providers: [
    ServerManagerService,
    ServerManagerResolver,
    ServerSettingsService,
    LogStorageService,
    LokiLoggerService,
    DatabaseLoggerService,
    PrometheusService,
  ],
  exports: [
    ServerManagerService,
    ServerSettingsService,
    LogStorageService,
    LokiLoggerService,
    DatabaseLoggerService,
    PrometheusService,
  ],
})
export class ServerManagerModule {}
