import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BUCKET_LINKS_CHANGED,
  BucketLinksChangedPayload,
} from '../common/events/bucket-events';
import { NtfySubscriptionService } from './ntfy-subscription.service';

@Injectable()
export class NtfyBucketEventsListener {
  constructor(
    private readonly ntfySubscriptionService: NtfySubscriptionService,
  ) {}

  @OnEvent(BUCKET_LINKS_CHANGED)
  handleBucketLinksChanged(payload: BucketLinksChangedPayload): void {
    this.ntfySubscriptionService.onBucketLinksChanged(
      payload.affectedSystemIds,
    );
  }
}
