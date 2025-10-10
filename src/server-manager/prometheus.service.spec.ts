import { Test, TestingModule } from '@nestjs/testing';
import { PrometheusService } from './prometheus.service';
import { register } from 'prom-client';

describe('PrometheusService', () => {
  let service: PrometheusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrometheusService],
    }).compile();

    service = module.get<PrometheusService>(PrometheusService);
  });

  afterEach(() => {
    service.resetMetrics();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should increment notification counter', () => {
    service.notificationsSentTotal.inc({
      platform: 'ios',
      bucket_id: 'test-bucket',
      delivery_type: 'push',
    });

    service.notificationsSentTotal.inc({
      platform: 'ios',
      bucket_id: 'test-bucket',
      delivery_type: 'push',
    });

    // The counter should have been incremented
    const metrics = service.getRegistry().getSingleMetric('zentik_notifications_sent_total');
    expect(metrics).toBeDefined();
  });

  it('should observe notification duration', () => {
    service.notificationsDuration.observe(
      {
        platform: 'android',
        delivery_type: 'push',
      },
      1.5,
    );

    const metrics = service.getRegistry().getSingleMetric('zentik_notifications_duration_seconds');
    expect(metrics).toBeDefined();
  });

  it('should set gauge value', () => {
    service.usersTotal.set(100);
    service.usersOnline.set(25);

    const usersTotalMetric = service.getRegistry().getSingleMetric('zentik_users_total');
    const usersOnlineMetric = service.getRegistry().getSingleMetric('zentik_users_online');

    expect(usersTotalMetric).toBeDefined();
    expect(usersOnlineMetric).toBeDefined();
  });

  it('should return metrics in text format', async () => {
    service.notificationsSentTotal.inc({
      platform: 'web',
      bucket_id: 'test',
      delivery_type: 'email',
    });

    const metrics = await service.getMetrics();
    expect(metrics).toContain('zentik_notifications_sent_total');
    expect(typeof metrics).toBe('string');
  });

  it('should return metrics in JSON format', async () => {
    service.apiRequestsTotal.inc({
      method: 'GET',
      route: '/api/test',
      status_code: '200',
    });

    const metricsJson = await service.getMetricsJSON();
    expect(Array.isArray(metricsJson)).toBe(true);
    expect(metricsJson.length).toBeGreaterThan(0);
  });

  it('should reset all metrics', () => {
    service.notificationsSentTotal.inc({
      platform: 'ios',
      bucket_id: 'test',
      delivery_type: 'push',
    });
    service.usersTotal.set(50);

    // Reset should work without errors
    expect(() => service.resetMetrics()).not.toThrow();
  });
});
