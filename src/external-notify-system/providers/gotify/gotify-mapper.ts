import { CreateMessageDto } from '../../../messages/dto';
import { Bucket } from '../../../entities/bucket.entity';
import { Message } from '../../../entities/message.entity';
import {
  MediaType,
  NotificationActionType,
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

const GOTIFY_EXTRAS_CLIENT_NOTIFICATION = 'client::notification';

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

  const extras: Record<string, unknown> = {
    [GOTIFY_ZENTIK_EXTRA_KEY]: GOTIFY_ZENTIK_EXTRA_VALUE,
  };

  const clientNotification: Record<string, unknown> = {};
  if (
    message.tapAction?.type === NotificationActionType.NAVIGATE &&
    message.tapAction.value
  ) {
    clientNotification['click'] = { url: message.tapAction.value };
  }
  const firstImageAttachment = message.attachments?.find(
    (a) => a.mediaType === MediaType.IMAGE && a.url,
  );
  if (firstImageAttachment?.url) {
    clientNotification['bigImageUrl'] = firstImageAttachment.url;
  }
  if (Object.keys(clientNotification).length > 0) {
    extras[GOTIFY_EXTRAS_CLIENT_NOTIFICATION] = clientNotification;
  }

  payload.extras = extras;

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

  const dto: CreateMessageDto = {
    title: title || 'Notification',
    body: body || undefined,
    deliveryType,
  };

  const clientNotif = gotify.extras?.[GOTIFY_EXTRAS_CLIENT_NOTIFICATION] as
    | { click?: { url?: string }; bigImageUrl?: string }
    | undefined;
  if (clientNotif?.click?.url) {
    dto.tapAction = {
      type: NotificationActionType.NAVIGATE,
      value: clientNotif.click.url,
    };
  }
  if (clientNotif?.bigImageUrl) {
    dto.attachments = [
      { mediaType: MediaType.IMAGE, url: clientNotif.bigImageUrl },
    ];
  }

  return dto;
}
