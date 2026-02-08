import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Bucket } from '../entities/bucket.entity';
import { ExternalNotifySystem } from '../entities/external-notify-system.entity';
import { User } from '../entities/user.entity';
import { UserSetting } from '../entities/user-setting.entity';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { MessagesModule } from '../messages/messages.module';
import { ExternalNotifySystemController } from './external-notify-system.controller';
import { ExternalNotifyCredentialsStore } from './external-notify-credentials.store';
import { ExternalNotifySystemResolver } from './external-notify-system.resolver';
import { ExternalNotifySystemService } from './external-notify-system.service';
import { GotifyBucketEventsListener } from './providers/gotify/gotify-bucket-events.listener';
import { GotifyService } from './providers/gotify/gotify.service';
import { GotifySubscriptionService } from './providers/gotify/gotify-subscription.service';
import { NtfyBucketEventsListener } from './providers/ntfy/ntfy-bucket-events.listener';
import { NtfyService } from './providers/ntfy/ntfy.service';
import { NtfySubscriptionService } from './providers/ntfy/ntfy-subscription.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalNotifySystem, User, UserSetting, Bucket]),
    AuthModule,
    EntityPermissionModule,
    forwardRef(() => MessagesModule),
  ],
  controllers: [ExternalNotifySystemController],
  providers: [
    ExternalNotifySystemService,
    ExternalNotifySystemResolver,
    ExternalNotifyCredentialsStore,
    NtfyService,
    NtfySubscriptionService,
    NtfyBucketEventsListener,
    GotifyService,
    GotifySubscriptionService,
    GotifyBucketEventsListener,
  ],
  exports: [
    ExternalNotifySystemService,
    ExternalNotifyCredentialsStore,
    NtfyService,
    NtfySubscriptionService,
    GotifyService,
    GotifySubscriptionService,
  ],
})
export class ExternalNotifySystemModule {}
