import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogStorageService } from '../../server-manager/log-storage.service';
import { LogLevel } from '../../entities/log.entity';

/**
 * Interceptor that logs HTTP requests to the database
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  constructor(private readonly logStorageService: LogStorageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only log HTTP requests, skip GraphQL and other types
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const duration = Date.now() - startTime;

          // Log successful requests
          const message = `${method} ${url} ${statusCode} - ${duration}ms`;
          
          // Save to database asynchronously
          this.logStorageService
            .saveLog(
              LogLevel.HTTP,
              message,
              'HTTP',
              undefined,
              {
                method,
                url,
                statusCode,
                duration,
                ip,
                userAgent,
              },
            )
            .catch((error) => {
              this.logger.error('Failed to save HTTP log', error);
            });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          // Log failed requests
          const message = `${method} ${url} ${statusCode} - ${duration}ms - ${error.message}`;
          
          // Save to database asynchronously
          this.logStorageService
            .saveLog(
              LogLevel.ERROR,
              message,
              'HTTP',
              error.stack,
              {
                method,
                url,
                statusCode,
                duration,
                ip,
                userAgent,
                errorMessage: error.message,
              },
            )
            .catch((err) => {
              this.logger.error('Failed to save HTTP error log', err);
            });
        },
      }),
    );
  }
}
