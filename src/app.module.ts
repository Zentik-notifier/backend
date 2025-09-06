import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { EventsModule } from './events/events.module';
import { GraphqlModule } from './graphql/graphql.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OAuthProvidersModule } from './oauth-providers/oauth-providers.module';
import { SystemAccessTokenModule } from './system-access-token/system-access-token.module';
import { UserBucketsModule } from './user-buckets/user-buckets.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';

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
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttlMs = Number(config.get('RATE_LIMIT_TTL_MS') ?? 60_000);
        const limit = Number(config.get('RATE_LIMIT_LIMIT') ?? 100);
        const maybeBlock = config.get('RATE_LIMIT_BLOCK_MS');
        const blockMs =
          typeof maybeBlock === 'string' || typeof maybeBlock === 'number'
            ? Number(maybeBlock)
            : undefined;
        const common =
          blockMs && !Number.isNaN(blockMs) ? { blockDuration: blockMs } : {};
        return [
          {
            ttl: Number.isNaN(ttlMs) ? 60_000 : ttlMs,
            limit: Number.isNaN(limit) ? 100 : limit,
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
    UserBucketsModule,
    AttachmentsModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppResolver,
    {
      provide: 'APP_GUARD',
      useClass: ThrottlerUserOrIpGuard,
    },
  ],
})
export class AppModule {}
