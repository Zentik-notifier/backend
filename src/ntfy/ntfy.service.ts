import { Injectable, Logger } from '@nestjs/common';
import { Message } from '../entities/message.entity';
import { messageToNtfyPayload, NtfyPublishPayload } from './ntfy-mapper';

export interface NtfyAuth {
  authUser?: string | null;
  authPassword?: string | null;
  authToken?: string | null;
}

@Injectable()
export class NtfyService {
  private readonly logger = new Logger(NtfyService.name);

  buildAuthHeaders(auth: NtfyAuth): Record<string, string> {
    if (auth.authToken) {
      return { Authorization: `Bearer ${auth.authToken}` };
    }
    if (auth.authUser && auth.authPassword) {
      const encoded = Buffer.from(
        `${auth.authUser}:${auth.authPassword}`,
        'utf-8',
      ).toString('base64');
      return { Authorization: `Basic ${encoded}` };
    }
    return {};
  }

  /** NTFY publish response: only id and time are persisted. */
  async publish(
    baseUrl: string,
    topic: string,
    payload: NtfyPublishPayload,
    auth?: NtfyAuth,
  ): Promise<{ id: string; time: number } | null> {
    const url = `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(topic)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      ...this.buildAuthHeaders(auth ?? {}),
    };
    if (payload.title) headers['X-Title'] = payload.title;
    if (payload.priority != null) headers['X-Priority'] = payload.priority.toString();
    if (payload.tags?.length) headers['X-Tags'] = payload.tags.join(',');
    if (payload.click) headers['X-Click'] = payload.click;
    if (payload.icon) headers['X-Icon'] = payload.icon;
    if (payload.attach) headers['X-Attach'] = payload.attach;
    if (payload.actions) headers['X-Actions'] = payload.actions;

    try {
      this.logger.debug(`NTFY publish POST ${url} topic=${topic}`);
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: payload.body,
      });
      if (!res.ok) {
        this.logger.warn(
          `NTFY publish failed: ${res.status} ${res.statusText} for ${url}`,
        );
        return null;
      }
      const data = (await res.json()) as { id?: string; time?: number };
      if (data?.id != null && data?.time != null) {
        this.logger.debug(`NTFY publish response id=${data.id} time=${data.time}`);
        return { id: data.id, time: data.time };
      }
      this.logger.warn(`NTFY publish response missing id/time: ${JSON.stringify(data)}`);
      return null;
    } catch (err: any) {
      this.logger.error(`NTFY publish error for ${url}: ${err?.message}`);
      return null;
    }
  }

  async publishMessage(
    message: Message,
    baseUrl: string,
    topic: string,
    auth?: NtfyAuth,
    bucket?: { iconUrl?: string | null } | null,
  ): Promise<{ id: string; time: number } | null> {
    const payload = messageToNtfyPayload(message, bucket as any);
    payload.tags = [...(payload.tags ?? []), 'Zentik'];
    return this.publish(baseUrl, topic, payload, auth);
  }
}

export const NTFY_ZENTIK_TAG = 'Zentik';
