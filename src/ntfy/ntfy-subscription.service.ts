import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject, forwardRef } from '@nestjs/common';
import { IsNull, Not, Repository } from 'typeorm';
import { ExternalNotifySystem } from '../entities/external-notify-system.entity';
import { Bucket } from '../entities/bucket.entity';
import { ExternalNotifySystemType } from '../entities/external-notify-system.entity';
import { MessagesService } from '../messages/messages.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { NtfyService, NtfyAuth } from './ntfy.service';
import { NtfyIncomingMessage, ntfyMessageToCreatePayload } from './ntfy-mapper';

function setEquals<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

@Injectable()
export class NtfySubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(NtfySubscriptionService.name);
  private abortControllers = new Map<string, AbortController>();
  private currentTopicsBySystemId = new Map<string, Set<string>>();

  constructor(
    @InjectRepository(ExternalNotifySystem)
    private readonly systemRepo: Repository<ExternalNotifySystem>,
    @InjectRepository(Bucket)
    private readonly bucketRepo: Repository<Bucket>,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    private readonly ntfyService: NtfyService,
  ) {}

  async onModuleInit() {
    await this.startAllSubscriptions();
  }

  async startAllSubscriptions() {
    const systems = await this.systemRepo.find({
      where: { type: ExternalNotifySystemType.NTFY },
      relations: ['user'],
    });
    for (const sys of systems) {
      this.subscribe(sys).catch((err) => {
        this.logger.error(
          `NTFY subscription failed for ${sys.baseUrl}: ${err?.message}`,
        );
      });
    }
  }

  async refreshSubscriptionForSystem(systemId: string): Promise<void> {
    const system = await this.systemRepo.findOne({
      where: { id: systemId, type: ExternalNotifySystemType.NTFY },
      relations: ['user'],
    });
    if (system) {
      this.subscribe(system).catch((err) => {
        this.logger.error(
          `NTFY subscription refresh failed for ${system.baseUrl}: ${err?.message}`,
        );
      });
    }
  }

  onBucketLinksChanged(affectedSystemIds: string[]): void {
    const ids = [...new Set(affectedSystemIds)].filter(Boolean);
    for (const id of ids) {
      this.refreshSubscriptionForSystem(id).catch(() => {});
    }
  }

  @Cron('0 * * * *')
  async hourlyRefreshSubscriptions(): Promise<void> {
    this.logger.log('Running hourly NTFY subscription refresh');
    await this.startAllSubscriptions();
  }

  private async subscribe(system: ExternalNotifySystem, reconnectDelayMs = 0) {
    if (reconnectDelayMs > 0) {
      await new Promise((r) => setTimeout(r, reconnectDelayMs));
    }
    const buckets = await this.bucketRepo.find({
      where: {
        externalNotifySystem: { id: system.id },
        externalSystemChannel: Not(IsNull()),
      },
      relations: ['user'],
    });
    const channels = [
      ...new Set(
        buckets
          .map((b) => b.externalSystemChannel)
          .filter((c): c is string => !!c),
      ),
    ];
    const newTopics = new Set(channels);
    if (channels.length === 0) {
      this.currentTopicsBySystemId.delete(system.id);
      this.abortControllers.get(system.id)?.abort();
      return;
    }

    const current = this.currentTopicsBySystemId.get(system.id);
    if (current && setEquals(current, newTopics)) {
      return;
    }

    const key = `${system.id}`;
    this.abortControllers.get(key)?.abort();
    this.currentTopicsBySystemId.set(system.id, newTopics);
    const ac = new AbortController();
    this.abortControllers.set(key, ac);

    const topicsSegment = channels.map((c) => encodeURIComponent(c)).join(',');
    const url = `${system.baseUrl.replace(/\/$/, '')}/${topicsSegment}/sse`;
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      ...this.ntfyService.buildAuthHeaders(this.authFrom(system)),
    };

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        this.logger.warn(
          `NTFY SSE ${url} returned ${res.status}, retrying in 30s`,
        );
        this.currentTopicsBySystemId.delete(system.id);
        this.subscribe(system, 30_000).catch(() => {});
        return;
      }
      await this.consumeStream(system, buckets, res.body as any, key);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      this.logger.warn(
        `NTFY SSE ${url} error: ${e?.message}, retrying in 30s`,
      );
      this.currentTopicsBySystemId.delete(system.id);
      this.subscribe(system, 30_000).catch(() => {});
      return;
    } finally {
      this.abortControllers.delete(key);
    }
    this.currentTopicsBySystemId.delete(system.id);
    this.subscribe(system, 30_000).catch(() => {});
  }

  private authFrom(system: ExternalNotifySystem): NtfyAuth {
    return {
      authUser: system.authUser,
      authPassword: system.authPassword,
      authToken: system.authToken,
    };
  }

  private async consumeStream(
    system: ExternalNotifySystem,
    buckets: Bucket[],
    body: NodeJS.ReadableStream,
    key: string,
  ) {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as NtfyIncomingMessage;
            if (data.event === 'message' && data.topic) {
              const bucketsForTopic = buckets.filter(
                (b) => b.externalSystemChannel === data.topic,
              );
              if (bucketsForTopic.length > 0) {
                this.handleMessage(system, data, bucketsForTopic).catch((err) =>
                  this.logger.error(
                    `NTFY handle message error: ${err?.message}`,
                  ),
                );
              }
            }
          } catch (_) {
            // ignore parse errors
          }
        }
      }
    };

    const reader = (body as unknown as ReadableStream<Uint8Array>).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) onData(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async handleMessage(
    system: ExternalNotifySystem,
    ntfy: NtfyIncomingMessage,
    buckets: Bucket[],
  ) {
    const payload = ntfyMessageToCreatePayload(ntfy);
    const dto: CreateMessageDto = {
      title: payload.title,
      body: payload.body,
      subtitle: payload.subtitle,
      tapAction: payload.tapAction,
      deliveryType: payload.deliveryType,
      attachments: payload.attachments,
    } as CreateMessageDto;

    for (const bucket of buckets) {
      const ownerId = bucket.user?.id;
      if (!ownerId) continue;
      try {
        await this.messagesService.create(
          { ...dto, bucketId: bucket.id },
          ownerId,
          true,
          undefined,
          { fromNtfy: true },
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to create message from NTFY for bucket ${bucket.id}: ${err?.message}`,
        );
      }
    }
  }
}
