import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { Bucket } from '../entities/bucket.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { UserDevice } from '../entities/user-device.entity';
import { User } from '../entities/user.entity';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { EventsModule } from '../events/events.module';
import { GraphQLSharedModule } from '../graphql/graphql-shared.module';
import { MessagesResolver } from '../graphql/resolvers/messages.resolver';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServerSettingsModule } from '../server-settings/server-settings.module';
import { MessagesCleanupScheduler } from './messages.cleanup.scheduler';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { UsersModule } from '../users/users.module';
import { PayloadMapperModule } from '../payload-mapper/payload-mapper.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Notification, UserDevice, Bucket, User]),
    AuthModule,
    forwardRef(() => NotificationsModule),
    AttachmentsModule,
    GraphQLSharedModule,
    CommonModule,
    EventsModule,
    EntityPermissionModule,
    PayloadMapperModule,
    UsersModule,
    ServerSettingsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesCleanupScheduler, MessagesResolver],
  exports: [MessagesService],
})
export class MessagesModule {}
