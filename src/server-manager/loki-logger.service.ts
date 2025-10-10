import { Injectable, Logger } from '@nestjs/common';
import { ServerSettingsService } from './server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';
import { LogLevel } from '../entities/log.entity';
import { LogStorageService } from './log-storage.service';
import { GetLogsInput } from './dto/get-logs.dto';

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

  constructor(
    private readonly serverSettingsService: ServerSettingsService,
    private readonly logStorageService: LogStorageService,
  ) {
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
   * Create Loki batch from log entries
   */
  createLokiBatch(logs: LogEntry[]): LokiBatch {
    // Group logs by their stream labels (level + context)
    const streamMap = new Map<string, Array<[string, string]>>();

    for (const log of logs) {
      const streamLabels = {
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
   * Get logs from database and return them in Loki format
   * This method is used by the REST API endpoint
   */
  async getLogsFromDatabase(input: GetLogsInput): Promise<LokiBatch> {
    // Get logs from database
    const paginatedLogs = await this.logStorageService.getLogs(input);

    // Convert database logs to LogEntry format
    const logEntries: LogEntry[] = paginatedLogs.logs.map((log) => ({
      timestamp: new Date(log.timestamp),
      level: log.level,
      message: log.message,
      context: log.context,
      trace: log.trace,
      metadata: log.metadata,
    }));

    // Create and return Loki batch
    return this.createLokiBatch(logEntries);
  }
}
