import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { BucketsModule } from './buckets/buckets.module';
import { CommonModule } from './common/common.module';

import { databaseConfig } from './config/database.config';
// import { oauthConfig } from './config/oauth.config';
import { ThrottlerUserOrIpGuard } from './common/guards/throttler-user-or-ip.guard';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { EventsModule } from './events/events.module';
import { GraphqlModule } from './graphql/graphql.module';
import { MessagesModule } from './messages/messages.module';
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
import { HttpMetricsInterceptor } from './prometheus/interceptors/http-metrics.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      // no custom loaders; use env variables directly
    }),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    GraphqlModule,
    ThrottlerModule.forRootAsync({
      imports: [ServerManagerModule],
      inject: [ServerSettingsService],
      useFactory: async (serverSettingsService: ServerSettingsService) => {
        const ttlMsSetting = await serverSettingsService.getSettingByType(ServerSettingType.RateLimitTtlMs);
        const limitSetting = await serverSettingsService.getSettingByType(ServerSettingType.RateLimitLimit);
        const blockMsSetting = await serverSettingsService.getSettingByType(ServerSettingType.RateLimitBlockMs);

        const ttlMs = ttlMsSetting?.valueNumber ?? 60_000;
        const limit = limitSetting?.valueNumber ?? 100;
        const blockMs = blockMsSetting?.valueNumber;

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
    NotificationsModule,
    MessagesModule,
    WebhooksModule,
    OAuthProvidersModule,
    PayloadMapperModule,
    AttachmentsModule,
    EventsModule,
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
    {
      provide: 'APP_INTERCEPTOR',
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class AppModule {}
