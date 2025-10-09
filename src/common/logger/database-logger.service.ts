import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { LogStorageService } from '../../server-manager/log-storage.service';
import { LogLevel } from '../../entities/log.entity';

/**
 * Custom logger that saves logs to database when storage is enabled
 * This logger wraps the default NestJS console logger and adds database persistence
 */
@Injectable({ scope: Scope.TRANSIENT })
export class DatabaseLoggerService implements LoggerService {
  private context?: string;

  constructor(private readonly logStorageService: LogStorageService) {}

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    const logContext = context || this.context;
    console.log(`[${logContext}] ${message}`);
    this.saveToDatabase(LogLevel.INFO, message, logContext);
  }

  error(message: any, trace?: string, context?: string) {
    const logContext = context || this.context;
    console.error(`[${logContext}] ${message}`, trace);
    this.saveToDatabase(LogLevel.ERROR, message, logContext, trace);
  }

  warn(message: any, context?: string) {
    const logContext = context || this.context;
    console.warn(`[${logContext}] ${message}`);
    this.saveToDatabase(LogLevel.WARN, message, logContext);
  }

  debug(message: any, context?: string) {
    const logContext = context || this.context;
    console.debug(`[${logContext}] ${message}`);
    this.saveToDatabase(LogLevel.DEBUG, message, logContext);
  }

  verbose(message: any, context?: string) {
    const logContext = context || this.context;
    console.log(`[VERBOSE] [${logContext}] ${message}`);
    this.saveToDatabase(LogLevel.VERBOSE, message, logContext);
  }

  /**
   * Save log to database asynchronously (fire and forget)
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

    // Save asynchronously without blocking the logging operation
    setImmediate(() => {
      this.logStorageService
        .saveLog(level, messageStr, context, trace)
        .catch((error) => {
          // Silently fail to avoid infinite loops
          console.error('Failed to save log to database:', error);
        });
    });
  }
}
