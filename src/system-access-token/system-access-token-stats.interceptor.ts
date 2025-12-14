import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SystemAccessTokenService } from './system-access-token.service';

/**
 * Interceptor that adds system access token statistics to response headers
 * when a system access token is used in the request.
 * 
 * Headers added:
 * - X-Token-Calls: Current monthly call count (after increment)
 * - X-Token-MaxCalls: Maximum monthly calls allowed
 * - X-Token-TotalCalls: Total calls ever made (after increment)
 * - X-Token-FailedCalls: Current monthly failed call count (after increment)
 * - X-Token-TotalFailedCalls: Total failed calls ever made (after increment)
 * - X-Token-LastReset: ISO timestamp of last monthly reset
 * - X-Token-Remaining: Remaining calls in current month (maxCalls - calls)
 * - X-Token-Id: The ID of the system access token used
 * 
 * Note: The external server calling notify-external should read these headers
 * from the response and update its own ServerSettings.SystemTokenUsageStats
 * to track token usage locally.
 */
@Injectable()
export class SystemAccessTokenStatsInterceptor implements NestInterceptor {
  constructor(
    private readonly systemAccessTokenService: SystemAccessTokenService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const sat = request.systemAccessToken;

    return next.handle().pipe(
      switchMap(async (result) => {
        // Only add headers if system access token is present and request is HTTP
        if (sat && context.getType() === 'http') {
          // Reload token to get updated values after increment
          const updatedToken = await this.systemAccessTokenService.findOne(sat.id);

          if (updatedToken) {
            const response = context.switchToHttp().getResponse();
            const remaining = updatedToken.maxCalls > 0 
              ? Math.max(0, updatedToken.maxCalls - updatedToken.calls)
              : null;

            response.setHeader('X-Token-Calls', updatedToken.calls || 0);
            response.setHeader('X-Token-MaxCalls', updatedToken.maxCalls || 0);
            response.setHeader('X-Token-TotalCalls', updatedToken.totalCalls || 0);
            response.setHeader('X-Token-FailedCalls', updatedToken.failedCalls || 0);
            response.setHeader('X-Token-TotalFailedCalls', updatedToken.totalFailedCalls || 0);
            response.setHeader('X-Token-Id', updatedToken.id);
            
            if (updatedToken.lastResetAt) {
              response.setHeader(
                'X-Token-LastReset',
                new Date(updatedToken.lastResetAt).toISOString(),
              );
            }
            
            if (remaining !== null) {
              response.setHeader('X-Token-Remaining', remaining);
            }
          }
        }

        return result;
      }),
    );
  }
}

