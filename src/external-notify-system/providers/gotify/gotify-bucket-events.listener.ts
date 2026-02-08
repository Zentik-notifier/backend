import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BUCKET_LINKS_CHANGED,
  BucketLinksChangedPayload,
} from '../../../common/events/bucket-events';
import { GotifySubscriptionService } from './gotify-subscription.service';

@Injectable()
export class GotifyBucketEventsListener {
  constructor(
    private readonly gotifySubscriptionService: GotifySubscriptionService,
  ) {}

  @OnEvent(BUCKET_LINKS_CHANGED)
  handleBucketLinksChanged(payload: BucketLinksChangedPayload): void {
    this.gotifySubscriptionService.onBucketLinksChanged(
      payload.affectedSystemIds,
    );
  }
}
