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

  async publish(
    baseUrl: string,
    topic: string,
    payload: NtfyPublishPayload,
    auth?: NtfyAuth,
  ): Promise<void> {
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
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: payload.body,
      });
      if (!res.ok) {
        this.logger.warn(
          `NTFY publish failed: ${res.status} ${res.statusText} for ${url}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`NTFY publish error for ${url}: ${err?.message}`);
    }
  }

  async publishMessage(
    message: Message,
    baseUrl: string,
    topic: string,
    auth?: NtfyAuth,
    bucket?: { iconUrl?: string | null } | null,
  ): Promise<void> {
    const payload = messageToNtfyPayload(message, bucket as any);
    return this.publish(baseUrl, topic, payload, auth);
  }
}
