import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { Bucket } from '../entities/bucket.entity';
import { EntityPermission } from '../entities/entity-permission.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { EventsModule } from '../events/events.module';
import { GraphQLSharedModule } from '../graphql/graphql-shared.module';
import { MessagesModule } from '../messages/messages.module';
import { SystemAccessTokenModule } from '../system-access-token/system-access-token.module';
import { UserBucketsModule } from '../user-buckets/user-buckets.module';
import { UsersModule } from '../users/users.module';
import { FirebasePushService } from './firebase-push.service';
import { IOSPushService } from './ios-push.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushNotificationOrchestratorService } from './push-orchestrator.service';
import { WebPushService } from './web-push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      Message,
      Bucket,
      UserDevice,
      EntityPermission,
    ]),
    UsersModule,
    AuthModule,
    CommonModule,
    EntityPermissionModule,
    EventsModule,
    GraphQLSharedModule,
    UserBucketsModule,
    forwardRef(() => MessagesModule),
    SystemAccessTokenModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    IOSPushService,
    FirebasePushService,
    WebPushService,
    PushNotificationOrchestratorService,
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
