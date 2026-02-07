import { Bucket } from '../entities/bucket.entity';
import { Message } from '../entities/message.entity';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from '../notifications/notifications.types';

export interface NtfyPublishPayload {
  body: string;
  title?: string;
  priority?: number;
  tags?: string[];
  click?: string;
  icon?: string;
  attach?: string;
}

const DELIVERY_TO_NTFY_PRIORITY: Record<NotificationDeliveryType, number> = {
  [NotificationDeliveryType.SILENT]: 2,
  [NotificationDeliveryType.NORMAL]: 3,
  [NotificationDeliveryType.CRITICAL]: 5,
  [NotificationDeliveryType.NO_PUSH]: 1,
};

export function messageToNtfyPayload(
  message: Message,
  bucket?: Bucket | null,
): NtfyPublishPayload {
  const body = message.body ?? message.title ?? '';
  const payload: NtfyPublishPayload = { body };
  const bucketRef = bucket ?? message.bucket;

  if (message.title) {
    payload.title = message.title;
  }

  payload.priority =
    DELIVERY_TO_NTFY_PRIORITY[message.deliveryType] ?? 3;

  if (message.tapAction?.type === NotificationActionType.NAVIGATE && message.tapAction.value) {
    payload.click = message.tapAction.value;
  }

  if (bucketRef?.iconUrl) {
    payload.icon = bucketRef.iconUrl;
  }

  const firstImageUrl = message.attachments?.find(
    (a) => a.mediaType === 'IMAGE' && a.url,
  )?.url;
  if (firstImageUrl) {
    payload.attach = firstImageUrl;
  }

  if (message.subtitle) {
    payload.tags = [message.subtitle];
  }

  return payload;
}

export interface NtfyIncomingMessage {
  id: string;
  time: number;
  event: string;
  topic: string;
  message?: string;
  title?: string;
  priority?: number;
  tags?: string[];
  click?: string;
  attachment?: { name?: string; url: string; type?: string; size?: number; expires?: number };
  actions?: Array<{ action: string; label: string; url?: string; clear?: boolean }>;
  icon?: string;
}

const NTFY_PRIORITY_TO_DELIVERY: Record<number, NotificationDeliveryType> = {
  1: NotificationDeliveryType.SILENT,
  2: NotificationDeliveryType.SILENT,
  3: NotificationDeliveryType.NORMAL,
  4: NotificationDeliveryType.NORMAL,
  5: NotificationDeliveryType.CRITICAL,
};

export function ntfyMessageToCreatePayload(ntfy: NtfyIncomingMessage): { title: string; body?: string; subtitle?: string; tapAction?: { type: NotificationActionType; value: string }; deliveryType: NotificationDeliveryType; attachments?: Array<{ mediaType: MediaType; url: string }> } {
  const title = ntfy.title ?? ntfy.topic ?? 'Notification';
  const body = ntfy.message ?? '';
  const deliveryType =
    NTFY_PRIORITY_TO_DELIVERY[ntfy.priority ?? 3] ?? NotificationDeliveryType.NORMAL;

  const result: {
    title: string;
    body?: string;
    subtitle?: string;
    tapAction?: { type: NotificationActionType; value: string };
    deliveryType: NotificationDeliveryType;
    attachments?: Array<{ mediaType: MediaType; url: string }>;
  } = {
    title,
    body: body || undefined,
    deliveryType,
  };

  if (ntfy.tags?.length) {
    result.subtitle = ntfy.tags.join(', ');
  }

  if (ntfy.click) {
    result.tapAction = {
      type: NotificationActionType.NAVIGATE,
      value: ntfy.click,
    };
  }

  if (ntfy.attachment?.url) {
    const mediaType = ntfy.attachment.type?.startsWith('image/')
      ? MediaType.IMAGE
      : ntfy.attachment.type?.startsWith('video/')
        ? MediaType.VIDEO
        : ntfy.attachment.type?.startsWith('audio/')
          ? MediaType.AUDIO
          : MediaType.IMAGE;
    result.attachments = [{ mediaType, url: ntfy.attachment.url }];
  }

  return result;
}

/**
 * NTFY properties NOT supported in our mapping (incoming or outgoing):
 *
 * Incoming (subscribe): icon (URL) – not stored on message; actions (array of
 *   action buttons) – we only map a single tap/click; email – not in our model;
 *   delay – not mapped; since (polling) – not used.
 *
 * Outgoing (publish): NTFY action buttons (view, http, broadcast) – we only send
 *   one click URL; email – not sent; delay – not sent; multiple attachments –
 *   we send at most one (first image); NTFY-specific headers (e.g. X-Markdown,
 *   X-Filename) – not sent.
 */
