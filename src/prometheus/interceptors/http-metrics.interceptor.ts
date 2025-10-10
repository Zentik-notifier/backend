import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrometheusService } from '../../server-manager/prometheus.service';
import { ServerSettingsService } from '../../server-manager/server-settings.service';
import { ServerSettingType } from '../../entities/server-setting.entity';

/**
 * Interceptor to collect HTTP metrics for all REST endpoints
 * Only active when Prometheus is enabled in server settings
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor, OnModuleInit {
  private readonly logger = new Logger(HttpMetricsInterceptor.name);
  private isEnabled = false;
  private metricsPath = '/metrics';

  constructor(
    private readonly prometheusService: PrometheusService,
    private readonly serverSettingsService: ServerSettingsService,
  ) {}

  async onModuleInit() {
    const prometheusEnabledSetting = await this.serverSettingsService.getSettingByType(
      ServerSettingType.PrometheusEnabled,
    );
    this.isEnabled = prometheusEnabledSetting?.valueBool ?? false;

    const pathSetting = await this.serverSettingsService.getSettingByType(
      ServerSettingType.PrometheusPath,
    );
    this.metricsPath = pathSetting?.valueText || '/metrics';

    if (this.isEnabled) {
      this.logger.log('✅ HTTP metrics collection enabled');
    } else {
      this.logger.log('⚠️  HTTP metrics collection disabled');
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip if Prometheus is disabled
    if (!this.isEnabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Safety check: ensure request exists and has required properties
    if (!request || !request.method) {
      return next.handle();
    }

    // Skip metrics and health endpoints to avoid recursion
    const requestPath = request.path || request.url || '';
    if (requestPath === this.metricsPath || 
        requestPath === '/metrics' || 
        requestPath === '/health' ||
        requestPath.includes('/metrics') ||
        requestPath.includes('/health')) {
      return next.handle();
    }

    const startTime = Date.now();
    const method = request.method;
    const route = this.extractRoute(request);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = response.statusCode;

          // Increment request counter
          this.prometheusService.apiRequestsTotal.inc({
            method,
            route,
            status_code: statusCode,
          });

          // Record request duration
          this.prometheusService.apiRequestDuration.observe(
            { method, route },
            duration,
          );
        },
        error: (error: any) => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = error.status || 500;

          // Increment request counter
          this.prometheusService.apiRequestsTotal.inc({
            method,
            route,
            status_code: statusCode,
          });

          // Record request duration
          this.prometheusService.apiRequestDuration.observe(
            { method, route },
            duration,
          );

          // Increment error counter
          this.prometheusService.apiErrorsTotal.inc({
            method,
            route,
            error_type: error.name || 'UnknownError',
          });
        },
      }),
    );
  }

  /**
   * Extract the route pattern from the request
   */
  private extractRoute(request: any): string {
    // Try to get the route pattern from the handler
    const handler = request.route?.path;
    if (handler) {
      return handler;
    }

    // Fallback to the URL path (sanitized)
    const path = request.path || request.url;
    return this.sanitizePath(path);
  }

  /**
   * Sanitize path to avoid high cardinality in metrics
   * Replace IDs and dynamic segments with placeholders
   */
  private sanitizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f-]{36}/gi, '/:id') // UUID
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\/[0-9a-f]{24}/g, '/:id') // MongoDB ObjectIDs
      .split('?')[0]; // Remove query parameters
  }
}
