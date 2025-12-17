import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';
import { IBuiltinParser, ParserOptions } from './builtin-parser.interface';

/**
 * EMQX Webhook payload (EMQX 4/5) - minimal superset.
 *
 * EMQX can emit many event types. Common ones:
 * - client.connected / client.disconnected
 * - session.subscribed / session.unsubscribed
 * - message.publish / message.delivered / message.acked
 */
export interface EmqxWebhookPayload {
  event?: string;
  /** Some integrations use `type` instead of `event` */
  type?: string;
  /** Unix epoch ms or seconds depending on config */
  timestamp?: number;
  ts?: number;

  clientid?: string;
  client_id?: string;
  username?: string;

  ipaddress?: string;
  ip?: string;

  reason?: string;
  disconn_reason?: string;

  topic?: string;
  qos?: number;
  retain?: boolean;

  payload?: string;
  /** Some payloads use `payload_raw`/`payload_str` in templates */
  payload_raw?: string;
  payload_str?: string;

  /** Published message fields sometimes include these */
  pub_props?: Record<string, any>;
  properties?: Record<string, any>;

  /** Subscription events */
  topic_filters?: string[];
  topic_filter?: string;
}

@Injectable()
export class EmqxParser implements IBuiltinParser {
  get builtInType(): PayloadMapperBuiltInType {
    return PayloadMapperBuiltInType.ZENTIK_EMQX;
  }

  get name(): string {
    return 'EMQX';
  }

  get description(): string {
    return 'Parser for EMQX webhooks - handles client connect/disconnect, subscribe/unsubscribe and message events. Supports common EMQX 4/5 webhook payload templates.';
  }

  async validate(payload: any, options?: ParserOptions): Promise<boolean> {
    return new Promise((resolve) => resolve(this.syncValidate(payload, options)));
  }

  private syncValidate(payload: any, _options?: ParserOptions): boolean {
    if (!payload || typeof payload !== 'object') return false;

    const event = this.getEvent(payload);
    if (!event) return false;

    // Accept the most common EMQX webhook event namespaces.
    if (
      event.startsWith('client.') ||
      event.startsWith('session.') ||
      event.startsWith('message.') ||
      event.startsWith('auth.') ||
      event.startsWith('delivery.')
    ) {
      return true;
    }

    // Some templates might just send event names like "connected".
    // We accept a small allow-list to avoid false positives.
    const allow = new Set([
      'connected',
      'disconnected',
      'subscribed',
      'unsubscribed',
      'publish',
      'delivered',
      'acked',
    ]);
    return allow.has(event);
  }

  async parse(payload: EmqxWebhookPayload, options?: ParserOptions): Promise<CreateMessageDto> {
    return new Promise((resolve) => resolve(this.syncParse(payload, options)));
  }

  private syncParse(payload: EmqxWebhookPayload, _options?: ParserOptions): CreateMessageDto {
    const event = this.getEvent(payload) ?? 'unknown';
    const clientId = this.getClientId(payload);
    const username = this.safeString(payload.username);
    const ip = this.safeString(payload.ipaddress ?? payload.ip);

    const title = this.buildTitle(event);
    const subtitleParts = [
      clientId ? `client: ${clientId}` : undefined,
      username ? `user: ${username}` : undefined,
    ].filter(Boolean);

    const bodyLines: string[] = [];
    if (ip) bodyLines.push(`ip: ${ip}`);

    const topic = this.safeString(payload.topic);
    if (topic) bodyLines.push(`topic: ${topic}`);

    const subs = this.getSubscriptionTopics(payload);
    if (subs.length > 0) bodyLines.push(`topics: ${subs.join(', ')}`);

    const reason = this.safeString(payload.reason ?? payload.disconn_reason);
    if (reason) bodyLines.push(`reason: ${reason}`);

    const qos = typeof payload.qos === 'number' ? payload.qos : undefined;
    if (qos !== undefined) bodyLines.push(`qos: ${qos}`);

    if (typeof payload.retain === 'boolean') bodyLines.push(`retain: ${payload.retain}`);

    const messageText = this.extractPayloadText(payload);
    if (messageText) bodyLines.push(`payload: ${messageText}`);

    const deliveryType = this.mapDeliveryType(event);

    return {
      title,
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(' • ') : undefined,
      body: bodyLines.length > 0 ? bodyLines.join('\n') : undefined,
      deliveryType,
      bucketId: '', // Will be set by the service
    };
  }

  private getEvent(payload: any): string | undefined {
    const raw = payload?.event ?? payload?.type;
    if (typeof raw !== 'string') return undefined;
    return raw.trim();
  }

  private getClientId(payload: EmqxWebhookPayload): string | undefined {
    return this.safeString(payload.clientid ?? payload.client_id);
  }

  private getSubscriptionTopics(payload: EmqxWebhookPayload): string[] {
    if (Array.isArray(payload.topic_filters)) {
      return payload.topic_filters.map((t) => this.safeString(t)).filter(Boolean) as string[];
    }
    const single = this.safeString(payload.topic_filter);
    return single ? [single] : [];
  }

  private buildTitle(event: string): string {
    // Keep it short for push UI.
    return `EMQX • ${event}`;
  }

  private mapDeliveryType(event: string): NotificationDeliveryType {
    const e = event.toLowerCase();

    // High-signal events
    if (e.includes('disconnected') || e.includes('auth') || e.includes('denied') || e.includes('error')) {
      return NotificationDeliveryType.CRITICAL;
    }

    // Noisy events can be silenced by default.
    if (e.includes('message.publish') || e === 'publish' || e.includes('message.delivered') || e === 'delivered') {
      return NotificationDeliveryType.SILENT;
    }

    return NotificationDeliveryType.NORMAL;
  }

  private extractPayloadText(payload: EmqxWebhookPayload): string | undefined {
    const raw =
      this.safeString(payload.payload_str) ??
      this.safeString(payload.payload_raw) ??
      this.safeString(payload.payload);

    if (!raw) return undefined;

    // Try base64 decode if it looks like base64.
    const decoded = this.tryDecodeBase64Utf8(raw);
    const text = decoded ?? raw;

    // Collapse whitespace and cap length.
    const compact = text.replace(/\s+/g, ' ').trim();
    if (!compact) return undefined;

    const maxLen = 240;
    return compact.length > maxLen ? `${compact.slice(0, maxLen)}…` : compact;
  }

  private tryDecodeBase64Utf8(value: string): string | undefined {
    const trimmed = value.trim();

    // Avoid decoding if it clearly isn't base64.
    if (trimmed.length < 8) return undefined;
    if (trimmed.length % 4 !== 0) return undefined;
    if (!/^[A-Za-z0-9+/=]+$/.test(trimmed)) return undefined;

    try {
      const buf = Buffer.from(trimmed, 'base64');
      if (!buf || buf.length === 0) return undefined;

      const decoded = buf.toString('utf8');

      // Heuristic: require some printable chars.
      const printableRatio = decoded.replace(/[\x09\x0A\x0D\x20-\x7E]/g, '').length / decoded.length;
      if (!Number.isFinite(printableRatio) || printableRatio > 0.15) return undefined;

      return decoded;
    } catch {
      return undefined;
    }
  }

  private safeString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
}
