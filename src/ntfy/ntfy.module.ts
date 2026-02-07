import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalNotifySystem } from '../entities/external-notify-system.entity';
import { Bucket } from '../entities/bucket.entity';
import { MessagesModule } from '../messages/messages.module';
import { NtfyBucketEventsListener } from './ntfy-bucket-events.listener';
import { NtfyService } from './ntfy.service';
import { NtfySubscriptionService } from './ntfy-subscription.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalNotifySystem, Bucket]),
    forwardRef(() => MessagesModule),
  ],
  providers: [NtfyService, NtfySubscriptionService, NtfyBucketEventsListener],
  exports: [NtfyService, NtfySubscriptionService],
})
export class NtfyModule {}
