import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { BucketsModule } from './buckets/buckets.module';
import { CommonModule } from './common/common.module';
import { databaseConfig } from './config/database.config';
import { ThrottlerUserOrIpGuard } from './common/guards/throttler-user-or-ip.guard';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { EntityPermissionModule } from './entity-permission/entity-permission.module';
import { EventsModule } from './events/events.module';
import { GraphqlModule } from './graphql/graphql.module';
import { MessagesModule } from './messages/messages.module';
import { AdminNotificationsModule } from './admin-notifications/admin-notifications.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OAuthProvidersModule } from './oauth-providers/oauth-providers.module';
import { PayloadMapperModule } from './payload-mapper/payload-mapper.module';
import { SystemAccessTokenModule } from './system-access-token/system-access-token.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ServerManagerModule } from './server-manager/server-manager.module';
import { EntityExecutionModule } from './entity-execution/entity-execution.module';
import { ServerSettingsService } from './server-manager/server-settings.service';
import { ServerSettingType } from './entities/server-setting.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    // Serve static frontend files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '../..', 'public'),
      exclude: ['/api', '/graphql'],
    }),
    GraphqlModule,
    ThrottlerModule.forRootAsync({
      imports: [ServerManagerModule],
      inject: [ServerSettingsService],
      useFactory: async (serverSettingsService: ServerSettingsService) => {
        // Prefer persisted server settings when available, otherwise fall back to env, then defaults.
        const ttlMsSetting = await serverSettingsService.getSettingByType(ServerSettingType.RateLimitTtlMs);
        const limitSetting = await serverSettingsService.getSettingByType(ServerSettingType.RateLimitLimit);
        const blockMsSetting = await serverSettingsService.getSettingByType(ServerSettingType.RateLimitBlockMs);

        const envTtlMs = process.env.RATE_LIMIT_TTL_MS
          ? parseInt(process.env.RATE_LIMIT_TTL_MS, 10)
          : undefined;
        const envLimit = process.env.RATE_LIMIT_LIMIT
          ? parseInt(process.env.RATE_LIMIT_LIMIT, 10)
          : undefined;
        const envBlockMs = process.env.RATE_LIMIT_BLOCK_MS
          ? parseInt(process.env.RATE_LIMIT_BLOCK_MS, 10)
          : undefined;

        const ttlMs = ttlMsSetting?.valueNumber ?? envTtlMs ?? 60_000;
        const limit = limitSetting?.valueNumber ?? envLimit ?? 100;
        const blockMs = blockMsSetting?.valueNumber ?? envBlockMs;

        const common = blockMs ? { blockDuration: blockMs } : {};

        return [
          {
            ttl: ttlMs,
            limit: limit,
            ...common,
          },
        ];
      },
    }),
    CommonModule,
    AuthModule,
    SystemAccessTokenModule,
    UsersModule,
    BucketsModule,
    EntityPermissionModule,
    NotificationsModule,
    MessagesModule,
    WebhooksModule,
    OAuthProvidersModule,
    PayloadMapperModule,
    AttachmentsModule,
    EventsModule,
    AdminNotificationsModule,
    ServerManagerModule,
    EntityExecutionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppResolver,
    {
      provide: 'APP_GUARD',
      useClass: ThrottlerUserOrIpGuard,
    },
    {
      provide: 'APP_INTERCEPTOR',
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule { }
