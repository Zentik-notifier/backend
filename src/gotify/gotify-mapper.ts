import { Bucket } from '../entities/bucket.entity';
import { Message } from '../entities/message.entity';
import { NotificationDeliveryType } from '../notifications/notifications.types';

export interface GotifyPublishPayload {
  message: string;
  title?: string;
  priority?: number;
}

const DELIVERY_TO_GOTIFY_PRIORITY: Record<NotificationDeliveryType, number> = {
  [NotificationDeliveryType.SILENT]: 2,
  [NotificationDeliveryType.NORMAL]: 5,
  [NotificationDeliveryType.CRITICAL]: 10,
  [NotificationDeliveryType.NO_PUSH]: 0,
};

export function messageToGotifyPayload(
  message: Message,
  _bucket?: Bucket | null,
): GotifyPublishPayload {
  const body = message.body ?? message.title ?? '';
  const payload: GotifyPublishPayload = { message: body };

  if (message.title) {
    payload.title = message.title;
  }

  payload.priority =
    DELIVERY_TO_GOTIFY_PRIORITY[message.deliveryType] ?? 5;

  return payload;
}
