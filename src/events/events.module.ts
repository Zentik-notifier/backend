import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities';
import { AdminSubscription } from '../entities/admin-subscription.entity';
import { UserDevice } from '../entities/user-device.entity';
import { User } from '../entities/user.entity';
import { Bucket } from '../entities/bucket.entity';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { EventTrackingService } from './event-tracking.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, AdminSubscription, UserDevice, User, Bucket]),
    forwardRef(() => AuthModule),
    forwardRef(() => MessagesModule),
  ],
  controllers: [EventsController],
  providers: [EventsService, EventTrackingService],
  exports: [EventsService, EventTrackingService],
})
export class EventsModule {}
