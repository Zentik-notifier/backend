import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { 
  Event,
  EventsPerUserDailyView,
  EventsPerUserWeeklyView,
  EventsPerUserMonthlyView,
  EventsPerUserAllTimeView,
  EventsPerBucketDailyView,
  EventsPerBucketWeeklyView,
  EventsPerBucketMonthlyView,
  EventsPerBucketAllTimeView,
  EventsPerDeviceDailyView,
  EventsPerDeviceWeeklyView,
  EventsPerDeviceMonthlyView,
  EventsPerDeviceAllTimeView,
  EventsPerTypeDailyView,
  EventsPerTypeWeeklyView,
  EventsPerTypeMonthlyView,
  EventsPerTypeAllTimeView,
  EventsPerBucketUserDailyView,
  EventsPerBucketUserWeeklyView,
  EventsPerBucketUserMonthlyView,
  EventsPerBucketUserAllTimeView,
} from '../entities';
import { AuthModule } from '../auth/auth.module';
import { EventTrackingService } from './event-tracking.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      EventsPerUserDailyView,
      EventsPerUserWeeklyView,
      EventsPerUserMonthlyView,
      EventsPerUserAllTimeView,
      EventsPerBucketDailyView,
      EventsPerBucketWeeklyView,
      EventsPerBucketMonthlyView,
      EventsPerBucketAllTimeView,
      EventsPerDeviceDailyView,
      EventsPerDeviceWeeklyView,
      EventsPerDeviceMonthlyView,
      EventsPerDeviceAllTimeView,
      EventsPerTypeDailyView,
      EventsPerTypeWeeklyView,
      EventsPerTypeMonthlyView,
      EventsPerTypeAllTimeView,
      EventsPerBucketUserDailyView,
      EventsPerBucketUserWeeklyView,
      EventsPerBucketUserMonthlyView,
      EventsPerBucketUserAllTimeView,
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [EventsController],
  providers: [EventsService, EventTrackingService],
  exports: [EventsService, EventTrackingService],
})
export class EventsModule {}
