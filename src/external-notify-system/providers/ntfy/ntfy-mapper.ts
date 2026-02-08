import { CreateMessageDto } from '../../../messages/dto';
import { Bucket } from '../../../entities/bucket.entity';
import { Message } from '../../../entities/message.entity';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from '../../../notifications/notifications.types';

export interface NtfyPublishPayload {
  body: string;
  title?: string;
  priority?: number;
  tags?: string[];
  click?: string;
  icon?: string;
  attach?: string;
  actions?: string;
}

const DELIVERY_TO_NTFY_PRIORITY: Record<NotificationDeliveryType, number> = {
  [NotificationDeliveryType.SILENT]: 2,
  [NotificationDeliveryType.NORMAL]: 3,
  [NotificationDeliveryType.CRITICAL]: 5,
  [NotificationDeliveryType.NO_PUSH]: 1,
};

function quoteForNtfyAction(v: string): string {
  if (/[,;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function messageToNtfyPayload(
  message: Message,
  bucket?: Bucket | null,
): NtfyPublishPayload {
  const body = message.body ?? message.title ?? '';
  const payload: NtfyPublishPayload = { body };
  const bucketRef = bucket ?? message.bucket;

  if (message.title) payload.title = message.title;
  payload.priority = DELIVERY_TO_NTFY_PRIORITY[message.deliveryType] ?? 3;

  if (message.tapAction?.type === NotificationActionType.NAVIGATE && message.tapAction.value) {
    payload.click = message.tapAction.value;
  }
  if (bucketRef?.iconUrl) payload.icon = bucketRef.iconUrl;

  const firstImageUrl = message.attachments?.find(
    (a) => a.mediaType === 'IMAGE' && a.url,
  )?.url;
  if (firstImageUrl) payload.attach = firstImageUrl;
  if (message.subtitle) payload.tags = [message.subtitle];

  const actions = message.actions ?? [];
  const ntfyActionParts: string[] = [];
  for (const a of actions.slice(0, 3)) {
    const label = a.title ?? '';
    const value = a.value ?? '';
    if (a.type === NotificationActionType.NAVIGATE && value) {
      ntfyActionParts.push(`view, ${quoteForNtfyAction(label)}, ${quoteForNtfyAction(value)}`);
    } else if (a.type === NotificationActionType.WEBHOOK && value) {
      ntfyActionParts.push(`http, ${quoteForNtfyAction(label)}, ${quoteForNtfyAction(value)}`);
    } else if (a.type === NotificationActionType.BACKGROUND_CALL) {
      const part = value
        ? `broadcast, ${quoteForNtfyAction(label)}, intent=${quoteForNtfyAction(value)}`
        : `broadcast, ${quoteForNtfyAction(label)}`;
      ntfyActionParts.push(part);
    }
  }
  if (ntfyActionParts.length) payload.actions = ntfyActionParts.join('; ');

  return payload;
}

export interface NtfyIncomingAction {
  action: string;
  label: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  intent?: string;
  extras?: Record<string, string>;
  clear?: boolean;
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
  actions?: NtfyIncomingAction[];
  icon?: string;
}

const NTFY_PRIORITY_TO_DELIVERY: Record<number, NotificationDeliveryType> = {
  1: NotificationDeliveryType.SILENT,
  2: NotificationDeliveryType.SILENT,
  3: NotificationDeliveryType.NORMAL,
  4: NotificationDeliveryType.NORMAL,
  5: NotificationDeliveryType.CRITICAL,
};

export function ntfyMessageToCreatePayload(ntfy: NtfyIncomingMessage): CreateMessageDto {
  let title = ntfy.title;
  let body = ntfy.message;
  if (!title) {
    title = body;
    body = undefined;
  }
  const deliveryType =
    NTFY_PRIORITY_TO_DELIVERY[ntfy.priority ?? 3] ?? NotificationDeliveryType.NORMAL;

  const result: CreateMessageDto = {
    title: title ?? '',
    body: body || undefined,
    deliveryType,
  };

  if (ntfy.tags?.length) result.subtitle = ntfy.tags.join(', ');
  if (ntfy.click) {
    result.tapAction = { type: NotificationActionType.NAVIGATE, value: ntfy.click };
  }

  if (ntfy.actions?.length) {
    result.actions = ntfy.actions
      .map((a) => {
        const label = a.label ?? '';
        if (a.action === 'view' && a.url) {
          return { type: NotificationActionType.NAVIGATE, value: a.url, title: label };
        }
        if (a.action === 'http' && a.url) {
          return { type: NotificationActionType.WEBHOOK, value: a.url, title: label };
        }
        if (a.action === 'broadcast') {
          return {
            type: NotificationActionType.BACKGROUND_CALL,
            value: a.intent ?? '',
            title: label,
          };
        }
        return null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
    if (result.actions.length === 0) result.actions = undefined;
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
