import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities';
import { AuthModule } from '../auth/auth.module';
import { EventTrackingService } from './event-tracking.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    forwardRef(() => AuthModule),
  ],
  controllers: [EventsController],
  providers: [EventsService, EventTrackingService],
  exports: [EventsService, EventTrackingService],
})
export class EventsModule {}
