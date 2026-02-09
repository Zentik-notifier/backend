import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { EventSource } from 'eventsource';
import { IsNull, Not, Repository } from 'typeorm';
import { Bucket } from '../../../entities/bucket.entity';
import { ExternalNotifySystem, ExternalNotifySystemType } from '../../../entities/external-notify-system.entity';
import { ServerSettingType } from '../../../entities/server-setting.entity';
import { ServerSettingsService } from '../../../server-manager/server-settings.service';
import { ExternalNotifyCredentialsStore } from '../../external-notify-credentials.store';
import { MessagesService } from '../../../messages/messages.service';
import { NtfyIncomingMessage, ntfyMessageToCreatePayload } from './ntfy-mapper';
import { NTFY_ZENTIK_TAG, NtfyAuth, NtfyService } from './ntfy.service';

function setEquals<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

const PUBLISHED_NTFY_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface NtfyUrlRecord {
  es: EventSource;
  systems: Map<string, { system: ExternalNotifySystem; buckets: Bucket[] }>;
}

@Injectable()
export class NtfySubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(NtfySubscriptionService.name);
  private eventSourcesByUrl = new Map<string, NtfyUrlRecord>();
  private systemIdToUrl = new Map<string, string>();
  private currentTopicsBySystemId = new Map<string, Set<string>>();
  private subscriptionLocksBySystemId = new Map<string, Promise<void>>();
  private subscriptionLocksByUrl = new Map<string, Promise<void>>();
  private publishedNtfyIds = new Map<string, number>();

  constructor(
    @InjectRepository(ExternalNotifySystem)
    private readonly systemRepo: Repository<ExternalNotifySystem>,
    @InjectRepository(Bucket)
    private readonly bucketRepo: Repository<Bucket>,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    private readonly ntfyService: NtfyService,
    private readonly credentialsStore: ExternalNotifyCredentialsStore,
    private readonly serverSettingsService: ServerSettingsService,
  ) { }

  async onModuleInit() {
    await this.startAllSubscriptions();
  }

  async startAllSubscriptions() {
    const enabled = await this.serverSettingsService.getBooleanValue(
      ServerSettingType.ExternalNotifySystemsEnabled,
      true,
    );
    if (!enabled) return;
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
    const enabled = await this.serverSettingsService.getBooleanValue(
      ServerSettingType.ExternalNotifySystemsEnabled,
      true,
    );
    if (!enabled) return;
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

  registerPublishedNtfyId(id: string): void {
    this.publishedNtfyIds.set(id, Date.now());
    this.prunePublishedNtfyIds();
  }

  isPublishedByUs(id: string): boolean {
    this.prunePublishedNtfyIds();
    const added = this.publishedNtfyIds.get(id);
    if (added == null) return false;
    this.publishedNtfyIds.delete(id);
    return true;
  }

  private prunePublishedNtfyIds(): void {
    const cutoff = Date.now() - PUBLISHED_NTFY_TTL_MS;
    for (const [id, ts] of this.publishedNtfyIds.entries()) {
      if (ts < cutoff) this.publishedNtfyIds.delete(id);
    }
  }

  onBucketLinksChanged(affectedSystemIds: string[]): void {
    const ids = [...new Set(affectedSystemIds)].filter(Boolean);
    for (const id of ids) {
      this.refreshSubscriptionForSystem(id).catch(() => { });
    }
  }

  @Cron('0 * * * *')
  async hourlyRefreshSubscriptions(): Promise<void> {
    this.logger.log('Running hourly NTFY subscription refresh');
    await this.startAllSubscriptions();
  }

  private async subscribe(system: ExternalNotifySystem, reconnectDelayMs = 0): Promise<void> {
    const key = system.id;
    const previous = this.subscriptionLocksBySystemId.get(key) ?? Promise.resolve();
    const run = previous.then(() => this.runSubscribe(system, reconnectDelayMs));
    this.subscriptionLocksBySystemId.set(key, run);
    try {
      await run;
    } finally {
      if (this.subscriptionLocksBySystemId.get(key) === run) {
        this.subscriptionLocksBySystemId.delete(key);
      }
    }
  }

  private async runSubscribe(system: ExternalNotifySystem, reconnectDelayMs: number): Promise<void> {
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
      this.removeSystemFromUrl(system.id);
      return;
    }

    const current = this.currentTopicsBySystemId.get(system.id);
    if (current && setEquals(current, newTopics)) {
      return;
    }

    this.currentTopicsBySystemId.set(system.id, newTopics);
    this.removeSystemFromUrl(system.id);

    const topicsSegment = channels.map((c) => encodeURIComponent(c)).join(',');
    const url = `${system.baseUrl.replace(/\/$/, '')}/${topicsSegment}/sse`;

    const urlPrevious = this.subscriptionLocksByUrl.get(url) ?? Promise.resolve();
    const urlRun = urlPrevious.then(() =>
      this.createOrAttachEventSource(url, system, buckets),
    );
    this.subscriptionLocksByUrl.set(url, urlRun);
    try {
      await urlRun;
    } finally {
      if (this.subscriptionLocksByUrl.get(url) === urlRun) {
        this.subscriptionLocksByUrl.delete(url);
      }
    }
  }

  private removeSystemFromUrl(systemId: string): void {
    const url = this.systemIdToUrl.get(systemId);
    if (!url) return;
    this.systemIdToUrl.delete(systemId);
    const record = this.eventSourcesByUrl.get(url);
    if (!record) return;
    record.systems.delete(systemId);
    if (record.systems.size === 0) {
      record.es.close();
      this.eventSourcesByUrl.delete(url);
    }
  }

  private async createOrAttachEventSource(
    url: string,
    system: ExternalNotifySystem,
    buckets: Bucket[],
  ): Promise<void> {
    const existing = this.eventSourcesByUrl.get(url);
    if (existing) {
      existing.systems.set(system.id, { system, buckets });
      this.systemIdToUrl.set(system.id, url);
      return;
    }

    try {
      const auth = await this.credentialsStore.get(system.userId, system.id);
      const authHeaders = this.ntfyService.buildAuthHeaders((auth as NtfyAuth) ?? {});

      const es = new EventSource(url, {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, {
            ...init,
            headers: { ...init?.headers, ...authHeaders },
          }),
      });

      const record: NtfyUrlRecord = { es, systems: new Map([[system.id, { system, buckets }]]) };
      this.eventSourcesByUrl.set(url, record);
      this.systemIdToUrl.set(system.id, url);

      es.addEventListener('open', () => {
        this.logger.debug(`NTFY EventSource open: ${url}`);
      });

      es.addEventListener('message', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as NtfyIncomingMessage;
          if (data.event === 'message' && data.topic) {
            for (const { system: s, buckets: b } of record.systems.values()) {
              const bucketsForTopic = b.filter(
                (bucket) => bucket.externalSystemChannel === data.topic,
              );
              if (bucketsForTopic.length > 0) {
                this.handleMessage(s, data, bucketsForTopic).catch((err) =>
                  this.logger.error(`NTFY handle message error: ${err?.message}`),
                );
              }
            }
          }
        } catch (_) {
          // ignore
        }
      });

      es.addEventListener('error', () => {
        es.close();
        const systemsToReconnect = [...record.systems.values()];
        this.eventSourcesByUrl.delete(url);
        for (const { system: s } of systemsToReconnect) {
          this.systemIdToUrl.delete(s.id);
          this.currentTopicsBySystemId.delete(s.id);
        }
        this.logger.warn(`NTFY EventSource error for ${url}, retrying in 30s`);
        for (const { system: s } of systemsToReconnect) {
          this.subscribe(s, 30_000).catch(() => {});
        }
      });
    } catch (err) {
      this.currentTopicsBySystemId.delete(system.id);
      throw err;
    }
  }

  private async handleMessage(
    system: ExternalNotifySystem,
    ntfy: NtfyIncomingMessage,
    buckets: Bucket[],
  ) {
    if (this.isPublishedByUs(ntfy.id)) return;
    if (ntfy.tags?.includes(NTFY_ZENTIK_TAG)) return;

    const dto = ntfyMessageToCreatePayload(ntfy);

    for (const bucket of buckets) {
      const ownerId = bucket.user?.id;
      if (!ownerId) continue;
      try {
        await this.messagesService.create(
          { ...dto, bucketId: bucket.id, ephemeral: true },
          ownerId,
          true,
          undefined,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to create message from NTFY for bucket ${bucket.id}: ${err?.message}`,
        );
      }
    }
  }
}
