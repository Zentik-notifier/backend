import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { WebSocket } from 'ws';
import { Bucket } from '../../../entities/bucket.entity';
import {
  ExternalNotifySystem,
  ExternalNotifySystemType,
} from '../../../entities/external-notify-system.entity';
import { ServerSettingType } from '../../../entities/server-setting.entity';
import { ServerSettingsService } from '../../../server-manager/server-settings.service';
import { ExternalNotifyCredentialsStore } from '../../external-notify-credentials.store';
import { MessagesService } from '../../../messages/messages.service';
import {
  GOTIFY_ZENTIK_EXTRA_KEY,
  GOTIFY_ZENTIK_EXTRA_VALUE,
  GotifyIncomingMessage,
  gotifyMessageToCreatePayload,
} from './gotify-mapper';

const PUBLISHED_GOTIFY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GOTIFY_PING_INTERVAL_MS = 10_000; // 10s, keep connection alive (proxies/servers often use 5–15s idle timeout)
const GOTIFY_FIRST_PING_DELAY_MS = 2_000; // send first ping soon after open to avoid idle timeout before first interval

@Injectable()
export class GotifySubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(GotifySubscriptionService.name);
  private socketsBySystemId = new Map<string, WebSocket>();
  private pingIntervalsBySystemId = new Map<string, NodeJS.Timeout>();
  private firstPingTimeoutsBySystemId = new Map<string, NodeJS.Timeout>();
  private publishedGotifyIds = new Map<string, number>(); // "systemId:id" -> timestamp

  constructor(
    @InjectRepository(ExternalNotifySystem)
    private readonly systemRepo: Repository<ExternalNotifySystem>,
    @InjectRepository(Bucket)
    private readonly bucketRepo: Repository<Bucket>,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    private readonly credentialsStore: ExternalNotifyCredentialsStore,
    private readonly serverSettingsService: ServerSettingsService,
  ) {}

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
      where: { type: ExternalNotifySystemType.Gotify },
      relations: ['user'],
    });
    for (const sys of systems) {
      this.subscribe(sys).catch((err) => {
        this.logger.error(
          `Gotify subscription failed for ${sys.baseUrl}: ${err?.message}`,
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
      where: { id: systemId, type: ExternalNotifySystemType.Gotify },
      relations: ['user'],
    });
    if (system) {
      this.subscribe(system).catch((err) => {
        this.logger.error(
          `Gotify subscription refresh failed for ${system.baseUrl}: ${err?.message}`,
        );
      });
    }
  }

  registerPublishedGotifyId(systemId: string, messageId: number): void {
    const key = `${systemId}:${messageId}`;
    this.publishedGotifyIds.set(key, Date.now());
    this.prunePublishedGotifyIds();
  }

  private isPublishedByUs(systemId: string, messageId: number): boolean {
    this.prunePublishedGotifyIds();
    const key = `${systemId}:${messageId}`;
    const added = this.publishedGotifyIds.get(key);
    if (added == null) return false;
    this.publishedGotifyIds.delete(key);
    return true;
  }

  private prunePublishedGotifyIds(): void {
    const cutoff = Date.now() - PUBLISHED_GOTIFY_TTL_MS;
    for (const [k, ts] of this.publishedGotifyIds.entries()) {
      if (ts < cutoff) this.publishedGotifyIds.delete(k);
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
    this.logger.log('Running hourly Gotify subscription refresh');
    await this.startAllSubscriptions();
  }

  private clearPingTimers(systemId: string): void {
    const intervalId = this.pingIntervalsBySystemId.get(systemId);
    if (intervalId) clearInterval(intervalId);
    this.pingIntervalsBySystemId.delete(systemId);
    const timeoutId = this.firstPingTimeoutsBySystemId.get(systemId);
    if (timeoutId) clearTimeout(timeoutId);
    this.firstPingTimeoutsBySystemId.delete(systemId);
  }

  private getStreamUrl(baseUrl: string, clientToken: string): string {
    const url = new URL(baseUrl.replace(/\/$/, '') || 'http://localhost');
    const wsProtocol = url.protocol === 'https:' ? 'wss' : 'ws';
    const path = url.pathname.replace(/\/$/, '') || '';
    return `${wsProtocol}://${url.host}${path}/stream?token=${encodeURIComponent(clientToken)}`;
  }

  private async subscribe(
    system: ExternalNotifySystem,
    reconnectDelayMs = 0,
  ): Promise<void> {
    if (reconnectDelayMs > 0) {
      await new Promise((r) => setTimeout(r, reconnectDelayMs));
    }

    const auth = await this.credentialsStore.get(system.userId, system.id);
    const clientToken = auth?.authPassword ?? auth?.authToken ?? null;
    if (!clientToken) {
      this.logger.debug(
        `Gotify subscription skipped for ${system.baseUrl}: no client token (authPassword or authToken)`,
      );
      return;
    }

    const existing = this.socketsBySystemId.get(system.id);
    if (existing) {
      this.clearPingTimers(system.id);
      existing.close();
      this.socketsBySystemId.delete(system.id);
    }

    const url = this.getStreamUrl(system.baseUrl, clientToken);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);

      ws.on('open', () => {
        this.logger.debug(`Gotify WebSocket connected to ${system.baseUrl}`);
        this.socketsBySystemId.set(system.id, ws);
        const firstPingTimeout = setTimeout(() => {
          this.firstPingTimeoutsBySystemId.delete(system.id);
          if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, GOTIFY_FIRST_PING_DELAY_MS);
        this.firstPingTimeoutsBySystemId.set(system.id, firstPingTimeout);
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, GOTIFY_PING_INTERVAL_MS);
        this.pingIntervalsBySystemId.set(system.id, pingInterval);
        resolve();
      });

      ws.on('message', (data: Buffer | Buffer[]) => {
        const raw = Buffer.isBuffer(data) ? data.toString('utf-8') : Buffer.concat(data as Buffer[]).toString('utf-8');
        try {
          const msg = JSON.parse(raw) as GotifyIncomingMessage;
          if (msg?.id != null && msg?.appid != null) {
            this.handleMessage(system, msg).catch((err) =>
              this.logger.error(
                `Gotify handle message error: ${err?.message}`,
              ),
            );
          }
        } catch (_) {
          // ignore parse errors
        }
      });

      ws.on('close', (code, reason) => {
        this.clearPingTimers(system.id);
        this.socketsBySystemId.delete(system.id);
        const delayMs = 5_000;
        this.logger.warn(
          `Gotify WebSocket closed ${system.baseUrl} code=${code} reason=${reason?.toString() ?? ''}, reconnecting in ${delayMs / 1000}s`,
        );
        this.subscribe(system, delayMs).catch(() => {});
      });

      ws.on('error', (err) => {
        this.clearPingTimers(system.id);
        this.socketsBySystemId.delete(system.id);
        const msg = err?.message ?? '';
        this.logger.warn(`Gotify WebSocket error ${system.baseUrl}: ${msg}`);
        if (msg.includes('401')) {
          this.logger.warn(
            `Gotify stream requires a client token (create one under Gotify "Clients"), not an application token.`,
          );
        }
        reject(err);
      });
    });
  }

  private async handleMessage(
    system: ExternalNotifySystem,
    gotify: GotifyIncomingMessage,
  ): Promise<void> {
    if (gotify.extras?.[GOTIFY_ZENTIK_EXTRA_KEY] === GOTIFY_ZENTIK_EXTRA_VALUE) return;
    if (this.isPublishedByUs(system.id, gotify.id)) return;

    const buckets = await this.bucketRepo.find({
      where: {
        externalNotifySystem: { id: system.id },
        externalSystemChannel: Not(IsNull()),
      },
      relations: ['user'],
    });

    const appIdStr = String(gotify.appid);
    const bucketsForApp = buckets.filter(
      (b) => b.externalSystemChannel === appIdStr,
    );
    if (bucketsForApp.length === 0) return;

    const dto = gotifyMessageToCreatePayload(gotify);

    for (const bucket of bucketsForApp) {
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
          `Failed to create message from Gotify for bucket ${bucket.id}: ${err?.message}`,
        );
      }
    }
  }
}
