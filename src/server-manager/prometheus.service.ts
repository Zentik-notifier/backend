import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
    Counter,
    Gauge,
    Histogram,
    register,
} from 'prom-client';

@Injectable()
export class PrometheusService implements OnModuleInit {
    private readonly logger = new Logger(PrometheusService.name);
    
    // Notification metrics
    public readonly notificationsSentTotal: Counter<string>;
    public readonly notificationsFailedTotal: Counter<string>;
    public readonly notificationsDuration: Histogram<string>;

    // API metrics
    public readonly apiRequestsTotal: Counter<string>;
    public readonly apiRequestDuration: Histogram<string>;
    public readonly apiErrorsTotal: Counter<string>;

    // Database metrics
    public readonly databaseQueriesTotal: Counter<string>;
    public readonly databaseQueryDuration: Histogram<string>;
    public readonly databaseConnectionsActive: Gauge<string>;

    // User metrics
    public readonly usersTotal: Gauge<string>;
    public readonly usersActive: Gauge<string>;
    public readonly usersOnline: Gauge<string>;

    // Message metrics
    public readonly messagesTotal: Counter<string>;
    public readonly messagesQueued: Gauge<string>;

    // Bucket metrics
    public readonly bucketsTotal: Gauge<string>;

    // Webhook metrics
    public readonly webhooksTriggeredTotal: Counter<string>;
    public readonly webhookDuration: Histogram<string>;

    // Push notification metrics
    public readonly pushNotificationsSentTotal: Counter<string>;
    public readonly pushNotificationsFailedTotal: Counter<string>;

    // Email metrics
    public readonly emailsSentTotal: Counter<string>;
    public readonly emailsFailedTotal: Counter<string>;

    // Authentication metrics
    public readonly authAttemptsTotal: Counter<string>;
    public readonly authSuccessTotal: Counter<string>;
    public readonly authFailureTotal: Counter<string>;

    // Cache metrics
    public readonly cacheHitsTotal: Counter<string>;
    public readonly cacheMissesTotal: Counter<string>;

    // Storage metrics
    public readonly storageUsedBytes: Gauge<string>;
    public readonly attachmentsTotal: Gauge<string>;

    onModuleInit() {
        this.logger.log('🔧 Prometheus metrics service initialized');
    }

    /**
     * Get or create a Counter metric
     */
    private getOrCreateCounter<T extends string>(config: {
        name: string;
        help: string;
        labelNames?: T[];
    }): Counter<T> {
        const existing = register.getSingleMetric(config.name);
        if (existing) {
            this.logger.debug(`♻️ Reusing existing counter: ${config.name}`);
            return existing as Counter<T>;
        }
        this.logger.debug(`✨ Creating new counter: ${config.name}`);
        return new Counter({
            ...config,
            registers: [register],
        });
    }

    /**
     * Get or create a Gauge metric
     */
    private getOrCreateGauge<T extends string>(config: {
        name: string;
        help: string;
        labelNames?: T[];
    }): Gauge<T> {
        const existing = register.getSingleMetric(config.name);
        if (existing) {
            this.logger.debug(`♻️ Reusing existing gauge: ${config.name}`);
            return existing as Gauge<T>;
        }
        this.logger.debug(`✨ Creating new gauge: ${config.name}`);
        return new Gauge({
            ...config,
            registers: [register],
        });
    }

    /**
     * Get or create a Histogram metric
     */
    private getOrCreateHistogram<T extends string>(config: {
        name: string;
        help: string;
        labelNames?: T[];
        buckets?: number[];
    }): Histogram<T> {
        const existing = register.getSingleMetric(config.name);
        if (existing) {
            this.logger.debug(`♻️ Reusing existing histogram: ${config.name}`);
            return existing as Histogram<T>;
        }
        this.logger.debug(`✨ Creating new histogram: ${config.name}`);
        return new Histogram({
            ...config,
            registers: [register],
        });
    }

    constructor() {
        // Get or create notification metrics
        this.notificationsSentTotal = this.getOrCreateCounter({
            name: 'zentik_notifications_sent_total',
            help: 'Total number of notifications sent',
            labelNames: ['platform', 'bucket_id', 'delivery_type'],
        });

        this.notificationsFailedTotal = this.getOrCreateCounter({
            name: 'zentik_notifications_failed_total',
            help: 'Total number of failed notifications',
            labelNames: ['platform', 'bucket_id', 'error_type'],
        });

        this.notificationsDuration = this.getOrCreateHistogram({
            name: 'zentik_notifications_duration_seconds',
            help: 'Duration of notification processing in seconds',
            labelNames: ['platform', 'delivery_type'],
            buckets: [0.1, 0.5, 1, 2, 5, 10],
        });

        // Initialize API metrics
        this.apiRequestsTotal = this.getOrCreateCounter({
            name: 'zentik_api_requests_total',
            help: 'Total number of API requests',
            labelNames: ['method', 'route', 'status_code'],
        });

        this.apiRequestDuration = this.getOrCreateHistogram({
            name: 'zentik_api_request_duration_seconds',
            help: 'Duration of API requests in seconds',
            labelNames: ['method', 'route'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
        });

        this.apiErrorsTotal = this.getOrCreateCounter({
            name: 'zentik_api_errors_total',
            help: 'Total number of API errors',
            labelNames: ['method', 'route', 'error_type'],
        });

        // Initialize database metrics
        this.databaseQueriesTotal = this.getOrCreateCounter({
            name: 'zentik_database_queries_total',
            help: 'Total number of database queries',
            labelNames: ['operation', 'table'],
        });

        this.databaseQueryDuration = this.getOrCreateHistogram({
            name: 'zentik_database_query_duration_seconds',
            help: 'Duration of database queries in seconds',
            labelNames: ['operation', 'table'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
        });

        this.databaseConnectionsActive = this.getOrCreateGauge({
            name: 'zentik_database_connections_active',
            help: 'Number of active database connections',
        });

        // Initialize user metrics
        this.usersTotal = this.getOrCreateGauge({
            name: 'zentik_users_total',
            help: 'Total number of registered users',
        });

        this.usersActive = this.getOrCreateGauge({
            name: 'zentik_users_active',
            help: 'Number of active users (logged in within 24h)',
        });

        this.usersOnline = this.getOrCreateGauge({
            name: 'zentik_users_online',
            help: 'Number of currently online users',
        });

        // Initialize message metrics
        this.messagesTotal = this.getOrCreateCounter({
            name: 'zentik_messages_total',
            help: 'Total number of messages created',
            labelNames: ['delivery_type'],
        });

        this.messagesQueued = this.getOrCreateGauge({
            name: 'zentik_messages_queued',
            help: 'Number of messages currently in queue',
        });

        // Initialize bucket metrics
        this.bucketsTotal = this.getOrCreateGauge({
            name: 'zentik_buckets_total',
            help: 'Total number of buckets',
        });

        // Initialize webhook metrics
        this.webhooksTriggeredTotal = this.getOrCreateCounter({
            name: 'zentik_webhooks_triggered_total',
            help: 'Total number of webhook triggers',
            labelNames: ['bucket_id', 'status'],
        });

        this.webhookDuration = this.getOrCreateHistogram({
            name: 'zentik_webhook_duration_seconds',
            help: 'Duration of webhook processing in seconds',
            labelNames: ['bucket_id'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
        });

        // Initialize push notification metrics
        this.pushNotificationsSentTotal = this.getOrCreateCounter({
            name: 'zentik_push_notifications_sent_total',
            help: 'Total number of push notifications sent',
            labelNames: ['platform', 'provider'],
        });

        this.pushNotificationsFailedTotal = this.getOrCreateCounter({
            name: 'zentik_push_notifications_failed_total',
            help: 'Total number of failed push notifications',
            labelNames: ['platform', 'provider', 'error_type'],
        });

        // Initialize email metrics
        this.emailsSentTotal = this.getOrCreateCounter({
            name: 'zentik_emails_sent_total',
            help: 'Total number of emails sent',
            labelNames: ['type'],
        });

        this.emailsFailedTotal = this.getOrCreateCounter({
            name: 'zentik_emails_failed_total',
            help: 'Total number of failed emails',
            labelNames: ['type', 'error_type'],
        });

        // Initialize authentication metrics
        this.authAttemptsTotal = this.getOrCreateCounter({
            name: 'zentik_auth_attempts_total',
            help: 'Total number of authentication attempts',
            labelNames: ['provider', 'method'],
        });

        this.authSuccessTotal = this.getOrCreateCounter({
            name: 'zentik_auth_success_total',
            help: 'Total number of successful authentications',
            labelNames: ['provider', 'method'],
        });

        this.authFailureTotal = this.getOrCreateCounter({
            name: 'zentik_auth_failure_total',
            help: 'Total number of failed authentications',
            labelNames: ['provider', 'method', 'reason'],
        });

        // Initialize cache metrics
        this.cacheHitsTotal = this.getOrCreateCounter({
            name: 'zentik_cache_hits_total',
            help: 'Total number of cache hits',
            labelNames: ['cache_name'],
        });

        this.cacheMissesTotal = this.getOrCreateCounter({
            name: 'zentik_cache_misses_total',
            help: 'Total number of cache misses',
            labelNames: ['cache_name'],
        });

        // Initialize storage metrics
        this.storageUsedBytes = this.getOrCreateGauge({
            name: 'zentik_storage_used_bytes',
            help: 'Total storage space used in bytes',
            labelNames: ['type'],
        });

        this.attachmentsTotal = this.getOrCreateGauge({
            name: 'zentik_attachments_total',
            help: 'Total number of attachments stored',
        });
    }

    /**
     * Get all metrics in Prometheus format
     */
    async getMetrics(): Promise<string> {
        return register.metrics();
    }

    /**
     * Get metrics in JSON format
     */
    async getMetricsJSON() {
        return register.getMetricsAsJSON();
    }

    /**
     * Reset all metrics (useful for testing)
     */
    resetMetrics(): void {
        register.resetMetrics();
    }

    /**
     * Get current registry
     */
    getRegistry() {
        return register;
    }
}
