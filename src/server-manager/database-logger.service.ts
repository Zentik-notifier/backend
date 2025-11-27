import { Injectable, LoggerService, Scope, Inject, forwardRef, Logger, ConsoleLogger, LogLevel as NestLogLevel } from '@nestjs/common';
import { LogStorageService } from './log-storage.service';
import { LogLevel } from '../entities/log-level.enum';
import { ServerSettingsService } from './server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

@Injectable({ scope: Scope.TRANSIENT })
export class DatabaseLoggerService implements LoggerService {
  private context?: string;
  private readonly nestLogger: ConsoleLogger;
  private currentLogLevel: string = 'info';

  constructor(
    private readonly logStorageService: LogStorageService,
    @Inject(forwardRef(() => ServerSettingsService))
    private readonly serverSettingsService: ServerSettingsService,
  ) {
    // Use NestJS default ConsoleLogger for formatting
    this.nestLogger = new ConsoleLogger();
    this.loadLogLevelFromSettings();
  }

  /**
   * Load log level from server settings and update ConsoleLogger
   */
  private async loadLogLevelFromSettings(): Promise<void> {
    try {
      const logLevel = await this.serverSettingsService.getStringValue(
        ServerSettingType.LogLevel,
        'info'
      );
      this.currentLogLevel = logLevel || 'verbose';

      // Map our log level to NestJS log levels
      const logLevels: NestLogLevel[] = this.getEnabledLogLevels(this.currentLogLevel);
      this.nestLogger.setLogLevels(logLevels);
    } catch (error) {
      // Fallback to default if settings not available yet
      this.currentLogLevel = 'info';
    }
  }

  /**
   * Get enabled log levels based on the configured level
   */
  private getEnabledLogLevels(level: string): NestLogLevel[] {
    const allLevels: NestLogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

    switch (level) {
      case 'error':
        return ['error'];
      case 'warn':
        return ['error', 'warn'];
      case 'info':
        return ['error', 'warn', 'log'];
      case 'debug':
        return ['error', 'warn', 'log', 'debug'];
      case 'verbose':
        return allLevels;
      default:
        return ['error', 'warn', 'log'];
    }
  }

  /**
   * Check if a log level should be saved based on current configuration
   */
  private shouldSaveLevel(level: LogLevel): boolean {
    const levelPriority: Record<string, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      verbose: 4,
    };

    const currentPriority = levelPriority[this.currentLogLevel] ?? 2;
    const messagePriority = levelPriority[level] ?? 2;

    return messagePriority <= currentPriority;
  }

  setContext(context: string) {
    this.context = context;
    this.nestLogger.setContext(context);
  }

  log(message: any, context?: string) {
    const logContext = context || this.context;
    // Use NestJS default logger for formatted console output
    this.nestLogger.log(message, logContext);
    this.saveToDatabase(LogLevel.INFO, message, logContext);
  }

  error(message: any, trace?: string, context?: string) {
    const logContext = context || this.context;
    // Use NestJS default logger for formatted console output
    this.nestLogger.error(message, trace, logContext);
    this.saveToDatabase(LogLevel.ERROR, message, logContext, trace);
  }

  warn(message: any, context?: string) {
    const logContext = context || this.context;
    // Use NestJS default logger for formatted console output
    this.nestLogger.warn(message, logContext);
    this.saveToDatabase(LogLevel.WARN, message, logContext);
  }

  debug(message: any, context?: string) {
    const logContext = context || this.context;
    // Use NestJS default logger for formatted console output
    this.nestLogger.debug(message, logContext);
    this.saveToDatabase(LogLevel.DEBUG, message, logContext);
  }

  verbose(message: any, context?: string) {
    const logContext = context || this.context;
    // Use NestJS default logger for formatted console output
    this.nestLogger.verbose(message, logContext);
    this.saveToDatabase(LogLevel.VERBOSE, message, logContext);
  }

  private saveToDatabase(
    level: LogLevel,
    message: any,
    context?: string,
    trace?: any,
  ): void {
    // Skip if level is not enabled
    if (!this.shouldSaveLevel(level)) {
      return;
    }

    // Extract message string and metadata from object if needed
    let messageStr: string;
    let metadata: any;

    if (typeof message === 'object' && message !== null) {
      // If message is an object with a 'message' property, use it
      if ('message' in message && typeof message.message === 'string') {
        messageStr = message.message;
        // Use the rest of the object as metadata (excluding the message property)
        const { message: _, ...rest } = message;
        metadata = Object.keys(rest).length > 0 ? rest : undefined;
      } else {
        // Otherwise stringify the whole object
        messageStr = JSON.stringify(message);
        metadata = message;
      }
    } else {
      messageStr = String(message);
      metadata = undefined;
    }

    // Convert trace to string if it's an object/Error
    const traceStr = trace 
      ? (typeof trace === 'string' 
          ? trace 
          : (trace instanceof Error 
              ? trace.stack || trace.message
              : JSON.stringify(trace)))
      : undefined;

    const timestamp = new Date();

    // Save asynchronously without blocking the logging operation
    setImmediate(() => {
      // Save to database
      this.logStorageService
        .saveLog(level, messageStr, context, traceStr, metadata)
        .catch((error) => {
          // Silently fail to avoid infinite loops
          console.error('Failed to save log to database:', error);
        });
    });
  }
}
