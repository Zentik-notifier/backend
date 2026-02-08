import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Bonjour, { Service } from 'bonjour-service';
import { API_PREFIX } from '../common/services/url-builder.service';

export const LAN_DISCOVERY_SERVICE_TYPE = 'zentik';
export const LAN_DISCOVERY_SERVICE_NAME = 'Zentik';

@Injectable()
export class LanDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LanDiscoveryService.name);
  private bonjour: Bonjour | null = null;
  private publishedService: Service | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.configService.get<string>('ENABLE_LAN_DISCOVERY') === 'true';
    if (!enabled) {
      this.logger.debug('LAN discovery disabled (ENABLE_LAN_DISCOVERY not set to true)');
      return;
    }

    const port = this.configService.get<number>('BACKEND_PORT', 3000);
    const path = API_PREFIX.replace(/^\//, '');

    try {
      this.bonjour = new Bonjour();
      this.publishedService = this.bonjour.publish({
        name: LAN_DISCOVERY_SERVICE_NAME,
        type: LAN_DISCOVERY_SERVICE_TYPE,
        port,
        txt: {
          path,
          version: '1',
        },
      });

      this.publishedService.on('error', (err: Error) => {
        this.logger.warn(`LAN discovery publish error: ${err?.message}`);
      });

      this.logger.log(`LAN discovery advertising _${LAN_DISCOVERY_SERVICE_TYPE}._tcp on port ${port} (path=${path})`);
    } catch (err) {
      this.logger.error(`LAN discovery failed to start: ${(err as Error)?.message}`);
      this.cleanup();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.cleanup();
  }

  private cleanup(): void {
    try {
      if (this.publishedService) {
        if (typeof this.publishedService.stop === 'function') {
          this.publishedService.stop(() => {});
        }
        this.publishedService = null;
      }
      if (this.bonjour) {
        this.bonjour.destroy();
        this.bonjour = null;
      }
    } catch {
      // ignore on teardown
    }
  }

  isActive(): boolean {
    return this.publishedService != null;
  }
}
