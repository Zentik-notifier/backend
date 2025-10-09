import { Injectable, Logger } from '@nestjs/common';
import { ServerSettingsService } from './server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';
import { LogLevel } from '../entities/log.entity';

interface LokiStream {
  stream: Record<string, string>;
  values: Array<[string, string]>; // [timestamp_ns, log_line]
}

interface LokiBatch {
  streams: LokiStream[];
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  trace?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LokiLoggerService {
  private readonly logger = new Logger(LokiLoggerService.name);
  private logQueue: LogEntry[] = [];
  private flushTimeout?: NodeJS.Timeout;
  private isEnabled = false;
  private lokiUrl?: string;
  private username?: string;
  private password?: string;
  private labels: Record<string, string> = {};
  private batchSize = 100;
  private batchIntervalMs = 5000;

  constructor(
    private readonly serverSettingsService: ServerSettingsService,
  ) {
    this.initializeSettings();
  }

  /**
   * Initialize Loki settings from server settings
   */
  private async initializeSettings(): Promise<void> {
    try {
      this.isEnabled = await this.serverSettingsService.getBooleanValue(
        ServerSettingType.LokiEnabled,
        false,
      );

      if (!this.isEnabled) {
        this.logger.log('Loki logging is disabled');
        return;
      }

      this.lokiUrl = (await this.serverSettingsService.getStringValue(
        ServerSettingType.LokiUrl,
      )) ?? undefined;

      this.username = (await this.serverSettingsService.getStringValue(
        ServerSettingType.LokiUsername,
      )) ?? undefined;

      this.password = (await this.serverSettingsService.getStringValue(
        ServerSettingType.LokiPassword,
      )) ?? undefined;

      const labelsString = await this.serverSettingsService.getStringValue(
        ServerSettingType.LokiLabels,
        'app=zentik-notifier',
      );
      this.labels = this.parseLabels(labelsString ?? 'app=zentik-notifier');

      this.batchSize = (await this.serverSettingsService.getNumberValue(
        ServerSettingType.LokiBatchSize,
        100,
      )) ?? 100;

      this.batchIntervalMs = (await this.serverSettingsService.getNumberValue(
        ServerSettingType.LokiBatchIntervalMs,
        5000,
      )) ?? 5000;

      if (!this.lokiUrl) {
        this.logger.warn('Loki URL is not configured. Disabling Loki logging.');
        this.isEnabled = false;
        return;
      }

      this.logger.log(`Loki logging initialized: ${this.lokiUrl}`);
      this.scheduleFlush();
    } catch (error) {
      this.logger.error('Failed to initialize Loki settings', error);
      this.isEnabled = false;
    }
  }

  /**
   * Parse labels string into object
   * Format: "key1=value1,key2=value2"
   */
  private parseLabels(labelsString: string): Record<string, string> {
    const labels: Record<string, string> = {};
    
    if (!labelsString) {
      return labels;
    }

    const pairs = labelsString.split(',');
    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (key && value) {
        labels[key] = value;
      }
    }

    return labels;
  }

  /**
   * Add log entry to queue
   */
  async pushLog(entry: LogEntry): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    this.logQueue.push(entry);

    // Flush immediately if batch size is reached
    if (this.logQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Schedule periodic flush
   */
  private scheduleFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }

    this.flushTimeout = setTimeout(async () => {
      await this.flush();
      this.scheduleFlush();
    }, this.batchIntervalMs);
  }

  /**
   * Flush logs to Loki
   */
  private async flush(): Promise<void> {
    if (this.logQueue.length === 0 || !this.isEnabled || !this.lokiUrl) {
      return;
    }

    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    try {
      const batch = this.createLokiBatch(logsToSend);
      await this.sendToLoki(batch);
    } catch (error) {
      this.logger.error('Failed to send logs to Loki', error);
      // Optionally: re-add logs to queue for retry
    }
  }

  /**
   * Create Loki batch from log entries
   */
  private createLokiBatch(logs: LogEntry[]): LokiBatch {
    // Group logs by their stream labels (level + context)
    const streamMap = new Map<string, Array<[string, string]>>();

    for (const log of logs) {
      const streamLabels = {
        ...this.labels,
        level: log.level,
        ...(log.context && { context: log.context }),
      };

      const streamKey = JSON.stringify(streamLabels);
      
      if (!streamMap.has(streamKey)) {
        streamMap.set(streamKey, []);
      }

      // Convert timestamp to nanoseconds
      const timestampNs = `${log.timestamp.getTime()}000000`;
      
      // Create log line with structured data
      const logLine = JSON.stringify({
        message: log.message,
        ...(log.trace && { trace: log.trace }),
        ...(log.metadata && { metadata: log.metadata }),
      });

      streamMap.get(streamKey)!.push([timestampNs, logLine]);
    }

    // Convert map to Loki streams format
    const streams: LokiStream[] = [];
    for (const [streamKey, values] of streamMap.entries()) {
      streams.push({
        stream: JSON.parse(streamKey),
        values: values.sort((a, b) => a[0].localeCompare(b[0])), // Sort by timestamp
      });
    }

    return { streams };
  }

  /**
   * Send batch to Loki
   */
  private async sendToLoki(batch: LokiBatch): Promise<void> {
    if (!this.lokiUrl) {
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add basic auth if credentials are provided
    if (this.username && this.password) {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const response = await fetch(`${this.lokiUrl}/loki/api/v1/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Loki API error: ${response.status} ${errorText}`);
    }

    this.logger.debug(`Successfully sent ${batch.streams.length} streams to Loki`);
  }

  /**
   * Force flush all pending logs
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * Reload settings (call this when settings are updated)
   */
  async reloadSettings(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    await this.initializeSettings();
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    await this.forceFlush();
  }
}
