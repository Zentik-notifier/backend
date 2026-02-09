import { CreateMessageDto } from '../../../messages/dto';
import { Bucket } from '../../../entities/bucket.entity';
import { Message } from '../../../entities/message.entity';
import {
  NotificationDeliveryType,
} from '../../../notifications/notifications.types';

export const GOTIFY_ZENTIK_EXTRA_KEY = 'zentik::source';
export const GOTIFY_ZENTIK_EXTRA_VALUE = 'zentik';

export interface GotifyPublishPayload {
  message: string;
  title?: string;
  priority?: number;
  extras?: Record<string, unknown>;
}

export interface GotifyIncomingMessage {
  id: number;
  appid: number;
  message: string;
  title?: string;
  date: string;
  priority?: number;
  extras?: Record<string, unknown>;
}

const DELIVERY_TO_GOTIFY_PRIORITY: Record<NotificationDeliveryType, number> = {
  [NotificationDeliveryType.SILENT]: 2,
  [NotificationDeliveryType.NORMAL]: 5,
  [NotificationDeliveryType.CRITICAL]: 10,
  [NotificationDeliveryType.NO_PUSH]: 0,
};

const GOTIFY_PRIORITY_TO_DELIVERY: Record<number, NotificationDeliveryType> = {
  0: NotificationDeliveryType.NO_PUSH,
  1: NotificationDeliveryType.SILENT,
  2: NotificationDeliveryType.SILENT,
  3: NotificationDeliveryType.NORMAL,
  4: NotificationDeliveryType.NORMAL,
  5: NotificationDeliveryType.NORMAL,
  6: NotificationDeliveryType.CRITICAL,
  7: NotificationDeliveryType.CRITICAL,
  8: NotificationDeliveryType.CRITICAL,
  9: NotificationDeliveryType.CRITICAL,
  10: NotificationDeliveryType.CRITICAL,
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

  payload.extras = { [GOTIFY_ZENTIK_EXTRA_KEY]: GOTIFY_ZENTIK_EXTRA_VALUE };

  return payload;
}

export function gotifyMessageToCreatePayload(
  gotify: GotifyIncomingMessage,
): CreateMessageDto {
  const title = gotify.title ?? gotify.message ?? '';
  const body = gotify.title != null ? gotify.message : undefined;
  const priority = gotify.priority ?? 5;
  const deliveryType =
    GOTIFY_PRIORITY_TO_DELIVERY[priority] ?? NotificationDeliveryType.NORMAL;

  return {
    title: title || 'Notification',
    body: body || undefined,
    deliveryType,
  };
}
