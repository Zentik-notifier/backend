import { Injectable, Logger } from '@nestjs/common';
import { Message } from '../entities/message.entity';
import { messageToGotifyPayload, GotifyPublishPayload } from './gotify-mapper';

@Injectable()
export class GotifyService {
  private readonly logger = new Logger(GotifyService.name);

  async publish(
    baseUrl: string,
    token: string,
    payload: GotifyPublishPayload,
  ): Promise<{ id: number } | null> {
    const url = `${baseUrl.replace(/\/$/, '')}/message?token=${encodeURIComponent(token)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    try {
      this.logger.debug(`Gotify publish POST ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.logger.warn(
          `Gotify publish failed: ${res.status} ${res.statusText} for ${url}`,
        );
        return null;
      }
      const data = (await res.json()) as { id?: number };
      if (data?.id != null) {
        this.logger.debug(`Gotify publish response id=${data.id}`);
        return { id: data.id };
      }
      return null;
    } catch (err: any) {
      this.logger.error(`Gotify publish error for ${url}: ${err?.message}`);
      return null;
    }
  }

  async publishMessage(
    message: Message,
    baseUrl: string,
    token: string,
    bucket?: { iconUrl?: string | null } | null,
  ): Promise<{ id: number } | null> {
    const payload = messageToGotifyPayload(message, bucket as any);
    return this.publish(baseUrl, token, payload);
  }
}
