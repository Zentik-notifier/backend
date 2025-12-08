import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { Bucket } from '../entities/bucket.entity';
import { Message } from '../entities/message.entity';
import { MessageReminder } from '../entities/message-reminder.entity';
import { Notification } from '../entities/notification.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { UserDevice } from '../entities/user-device.entity';
import { User } from '../entities/user.entity';
import { UserTemplate } from '../entities/user-template.entity';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { EventsModule } from '../events/events.module';
import { GraphQLSharedModule } from '../graphql/graphql-shared.module';
import { MessagesResolver } from './messages.resolver';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServerManagerModule } from '../server-manager/server-manager.module';
import { MessagesCleanupScheduler } from './messages.cleanup.scheduler';
import { MessageReminderScheduler } from './message-reminder.scheduler';
import { MessageReminderService } from './message-reminder.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { UserTemplatesController } from './user-templates.controller';
import { UserTemplatesResolver } from './user-templates.resolver';
import { UserTemplatesService } from './user-templates.service';
import { UsersModule } from '../users/users.module';
import { PayloadMapperModule } from '../payload-mapper/payload-mapper.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageReminder, Notification, UserDevice, Bucket, User, UserBucket, UserTemplate]),
    AuthModule,
    forwardRef(() => NotificationsModule),
    AttachmentsModule,
    GraphQLSharedModule,
    CommonModule,
    EventsModule,
    EntityPermissionModule,
    PayloadMapperModule,
    UsersModule,
    ServerManagerModule,
  ],
  controllers: [MessagesController, UserTemplatesController],
  providers: [
    MessagesService,
    MessageReminderService,
    MessagesCleanupScheduler,
    MessageReminderScheduler,
    MessagesResolver,
    UserTemplatesService,
    UserTemplatesResolver,
  ],
  exports: [MessagesService, MessageReminderService, MessagesResolver, UserTemplatesService],
})
export class MessagesModule {}
