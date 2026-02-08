import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { Bucket } from '../entities/bucket.entity';
import { EntityPermission } from '../entities/entity-permission.entity';
import { Event } from '../entities/event.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationPostpone } from '../entities/notification-postpone.entity';
import { UserDevice } from '../entities/user-device.entity';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { EntityExecutionModule } from '../entity-execution/entity-execution.module';
import { EventsModule } from '../events/events.module';
import { GraphQLSharedModule } from '../graphql/graphql-shared.module';
import { MessagesModule } from '../messages/messages.module';
import { BucketsModule } from '../buckets/buckets.module';
import { ServerManagerModule } from '../server-manager/server-manager.module';
import { SystemAccessTokenModule } from '../system-access-token/system-access-token.module';
import { UsersModule } from '../users/users.module';
import { FirebasePushService } from './firebase-push.service';
import { IOSPushService } from './ios-push.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationPostponeService } from './notification-postpone.service';
import { NotificationPostponeScheduler } from './notification-postpone.scheduler';
import { PushNotificationOrchestratorService } from './push-orchestrator.service';
import { WebPushService } from './web-push.service';
import { NotificationsResolver } from './notifications.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPostpone,
      Message,
      Bucket,
      UserDevice,
      EntityPermission,
      Event,
    ]),
    UsersModule,
    AuthModule,
    CommonModule,
    EntityPermissionModule,
    EntityExecutionModule,
    EventsModule,
    GraphQLSharedModule,
    forwardRef(() => MessagesModule),
    forwardRef(() => BucketsModule),
    ServerManagerModule,
    SystemAccessTokenModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationPostponeService,
    NotificationPostponeScheduler,
    IOSPushService,
    FirebasePushService,
    WebPushService,
    PushNotificationOrchestratorService,
    NotificationsResolver,
  ],
  exports: [
    NotificationsService,
    NotificationPostponeService,
    IOSPushService,
    FirebasePushService,
    WebPushService,
    PushNotificationOrchestratorService,
  ],
})
export class NotificationsModule {}
