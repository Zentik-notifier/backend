import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';

const BUFFER_MAX_ITEMS = 200;
const BUFFER_MAX_AGE_MS = 5 * 60 * 1000;

export interface StreamEvent {
  at: number;
  type: 'message_created' | 'message_deleted';
  message?: Record<string, unknown>;
  messageId?: string;
}

@Injectable()
export class MessagesStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly buffers = new Map<string, StreamEvent[]>();
  private readonly notifier = new EventEmitter();
  private notifierMaxListeners = 500;
  private messageCreatedIterator: AsyncGenerator<unknown> | null = null;
  private messageDeletedIterator: AsyncGenerator<unknown> | null = null;
  private running = false;

  constructor(private readonly subscriptionService: GraphQLSubscriptionService) {
    this.notifier.setMaxListeners(this.notifierMaxListeners);
  }

  private bufferKey(userId: string, bucketId?: string): string {
    return bucketId ? `${userId}:${bucketId}` : userId;
  }

  private push(userId: string, bucketId: string | undefined, event: StreamEvent): void {
    const key = this.bufferKey(userId, bucketId);
    let list = this.buffers.get(key);
    if (!list) {
      list = [];
      this.buffers.set(key, list);
    }
    list.push(event);
    if (list.length > BUFFER_MAX_ITEMS) list.shift();
    const cutoff = Date.now() - BUFFER_MAX_AGE_MS;
    while (list.length > 0 && list[0].at < cutoff) list.shift();
    this.notifier.emit(`event:${key}`);
  }

  getEvents(userId: string, bucketId: string | undefined, since: number): StreamEvent[] {
    const key = this.bufferKey(userId, bucketId);
    const list = this.buffers.get(key) ?? [];
    return list.filter((e) => e.at > since);
  }

  waitForNext(userId: string, bucketId: string | undefined, timeoutMs: number): Promise<boolean> {
    const key = this.bufferKey(userId, bucketId);
    const eventKey = `event:${key}`;
    return new Promise((resolve) => {
      const handler = () => {
        this.notifier.off(eventKey, handler);
        resolve(true);
      };
      this.notifier.once(eventKey, handler);
      setTimeout(() => {
        this.notifier.off(eventKey, handler);
        resolve(false);
      }, timeoutMs);
    });
  }

  private async runMessageCreatedLoop(): Promise<void> {
    const it = this.subscriptionService.messageCreated();
    this.messageCreatedIterator = it as AsyncGenerator<unknown>;
    try {
      for await (const payload of it as AsyncIterable<{
        userId: string;
        messageCreated?: { bucketId?: string } & Record<string, unknown>;
      }>) {
        if (!this.running || !payload?.userId) continue;
        const message = payload.messageCreated;
        if (!message) continue;
        const bucketId = typeof message.bucketId === 'string' ? message.bucketId : undefined;
        const event: StreamEvent = {
          at: Date.now(),
          type: 'message_created',
          message: message as Record<string, unknown>,
        };
        this.push(payload.userId, undefined, event);
        if (bucketId) this.push(payload.userId, bucketId, event);
      }
    } catch {
      // iterator closed or error
    }
  }

  private async runMessageDeletedLoop(): Promise<void> {
    const it = this.subscriptionService.messageDeleted();
    this.messageDeletedIterator = it as AsyncGenerator<unknown>;
    try {
      for await (const payload of it as AsyncIterable<{ userId: string; messageDeleted?: string }>) {
        if (!this.running || !payload?.userId) continue;
        const messageId = payload.messageDeleted;
        if (messageId == null) continue;
        const event: StreamEvent = { at: Date.now(), type: 'message_deleted', messageId };
        this.push(payload.userId, undefined, event);
      }
    } catch {
      // iterator closed or error
    }
  }

  async onModuleInit(): Promise<void> {
    this.running = true;
    this.runMessageCreatedLoop();
    this.runMessageDeletedLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    if (this.messageCreatedIterator?.return) this.messageCreatedIterator.return(undefined);
    if (this.messageDeletedIterator?.return) this.messageDeletedIterator.return(undefined);
    this.notifier.removeAllListeners();
  }
}
