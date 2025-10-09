import { Injectable, LoggerService, Scope, Inject, forwardRef, Logger, ConsoleLogger } from '@nestjs/common';
import { LogStorageService } from '../../server-manager/log-storage.service';
import { LokiLoggerService } from '../../server-manager/loki-logger.service';
import { LogLevel } from '../../entities/log.entity';

/**
 * Custom logger that saves logs to database and sends to Loki when enabled
 * This logger wraps the default NestJS console logger and adds persistence
 */
@Injectable({ scope: Scope.TRANSIENT })
export class DatabaseLoggerService implements LoggerService {
  private context?: string;
  private readonly nestLogger: ConsoleLogger;

  constructor(
    private readonly logStorageService: LogStorageService,
    @Inject(forwardRef(() => LokiLoggerService))
    private readonly lokiLoggerService: LokiLoggerService,
  ) {
    // Use NestJS default ConsoleLogger for formatting
    this.nestLogger = new ConsoleLogger();
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

  /**
   * Save log to database and send to Loki asynchronously (fire and forget)
   */
  private saveToDatabase(
    level: LogLevel,
    message: any,
    context?: string,
    trace?: string,
  ): void {
    // Convert message to string if it's an object
    const messageStr = typeof message === 'string' 
      ? message 
      : JSON.stringify(message);

    const metadata = typeof message === 'object' && message !== null ? message : undefined;
    const timestamp = new Date();

    // Save asynchronously without blocking the logging operation
    setImmediate(() => {
      // Save to database
      this.logStorageService
        .saveLog(level, messageStr, context, trace, metadata)
        .catch((error) => {
          // Silently fail to avoid infinite loops
          console.error('Failed to save log to database:', error);
        });

      // Send to Loki
      this.lokiLoggerService
        .pushLog({
          timestamp,
          level,
          message: messageStr,
          context,
          trace,
          metadata,
        })
        .catch((error) => {
          // Silently fail to avoid infinite loops
          console.error('Failed to send log to Loki:', error);
        });
    });
  }
}
