import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event, UserLog } from '../entities';
import { AuthModule } from '../auth/auth.module';
import { EventTrackingService } from './event-tracking.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { UserLogsService } from './user-logs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, UserLog]),
    forwardRef(() => AuthModule),
  ],
  controllers: [EventsController],
  providers: [EventsService, EventTrackingService, UserLogsService],
  exports: [EventsService, EventTrackingService, UserLogsService],
})
export class EventsModule {}
