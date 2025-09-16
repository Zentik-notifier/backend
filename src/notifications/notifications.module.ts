import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { Bucket } from '../entities/bucket.entity';
import { EntityPermission } from '../entities/entity-permission.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { 
  EventsPerUserDailyView,
  EventsPerUserWeeklyView,
  EventsPerUserMonthlyView,
  EventsPerUserAllTimeView
} from '../entities/views/events-analytics.views';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { EventsModule } from '../events/events.module';
import { GraphQLSharedModule } from '../graphql/graphql-shared.module';
import { MessagesModule } from '../messages/messages.module';
import { BucketsModule } from '../buckets/buckets.module';
import { SystemAccessTokenModule } from '../system-access-token/system-access-token.module';
import { UsersModule } from '../users/users.module';
import { FirebasePushService } from './firebase-push.service';
import { IOSPushService } from './ios-push.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushNotificationOrchestratorService } from './push-orchestrator.service';
import { WebPushService } from './web-push.service';
import { NotificationsResolver } from '../graphql/resolvers/notifications.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      Message,
      Bucket,
      UserDevice,
      EntityPermission,
      EventsPerUserDailyView,
      EventsPerUserWeeklyView,
      EventsPerUserMonthlyView,
      EventsPerUserAllTimeView,
    ]),
    UsersModule,
    AuthModule,
    CommonModule,
    EntityPermissionModule,
    EventsModule,
    GraphQLSharedModule,
    forwardRef(() => MessagesModule),
  BucketsModule,
    SystemAccessTokenModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    IOSPushService,
    FirebasePushService,
    WebPushService,
    PushNotificationOrchestratorService,
    NotificationsResolver,
  ],
  exports: [
    NotificationsService,
    IOSPushService,
    FirebasePushService,
    WebPushService,
    PushNotificationOrchestratorService,
  ],
})
export class NotificationsModule {}
