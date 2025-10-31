import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSubscription } from '../entities/admin-subscription.entity';
import { UserDevice } from '../entities/user-device.entity';
import { UserSession } from '../entities/user-session.entity';
import { User } from '../entities/user.entity';
import { Bucket } from '../entities/bucket.entity';
import { MessagesModule } from '../messages/messages.module';
import { EventsModule } from '../events/events.module';
import { AdminNotificationsService } from './admin-notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminSubscription,
      UserDevice,
      UserSession,
      User,
      Bucket,
    ]),
    MessagesModule,
    EventsModule,
  ],
  providers: [AdminNotificationsService],
  exports: [AdminNotificationsService],
})
export class AdminNotificationsModule {}
