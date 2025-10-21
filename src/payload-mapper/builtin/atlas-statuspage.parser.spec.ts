import { AtlasStatuspageParser, StatuspageIncidentWebhook, StatuspageComponentWebhook } from './atlas-statuspage.parser';
import { NotificationDeliveryType } from '../../notifications/notifications.types';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';

describe('AtlasStatuspageParser', () => {
  let parser: AtlasStatuspageParser;

  beforeEach(() => {
    parser = new AtlasStatuspageParser();
  });

  describe('Metadata', () => {
    it('should have correct name', () => {
      expect(parser.name).toBe('Atlassian Statuspage');
    });

    it('should have correct builtInType', () => {
      expect(parser.builtInType).toBe(PayloadMapperBuiltInType.ZENTIK_ATLAS_STATUSPAGE);
    });

    it('should have correct description', () => {
      expect(parser.description).toBe('Parser for Atlassian Statuspage webhooks - handles incidents and component updates');
    });
  });

  describe('validate', () => {
    it('should validate a valid incident payload', async () => {
      const payload: StatuspageIncidentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'critical',
          status_description: 'Major System Outage',
        },
        incident: {
          backfilled: false,
          created_at: '2013-05-29T15:08:51-06:00',
          impact: 'critical',
          impact_override: null,
          monitoring_at: null,
          name: 'Virginia Is Down',
          resolved_at: null,
          status: 'investigating',
          updated_at: '2013-05-29T16:30:35-06:00',
          id: 'lbkhbwn21v5q',
          organization_id: 'j2mfxwj97wnj',
          shortlink: 'http://j.mp/18zyDQx',
          scheduled_for: null,
          scheduled_until: null,
          scheduled_auto_transition: false,
          scheduled_remind_prior: false,
          scheduled_reminded_at: null,
          postmortem_body: null,
          postmortem_body_last_updated_at: null,
          postmortem_ignored: false,
          postmortem_notified_subscribers: false,
          postmortem_notified_twitter: false,
          postmortem_published_at: null,
          incident_updates: [],
        },
      };

      const isValid = await parser.validate(payload);
      expect(isValid).toBe(true);
    });

    it('should validate a valid component update payload', async () => {
      const payload: StatuspageComponentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'major',
          status_description: 'Partial System Outage',
        },
        component_update: {
          created_at: '2013-05-29T21:32:28Z',
          new_status: 'operational',
          old_status: 'major_outage',
          id: 'k7730b5v92bv',
          component_id: 'rb5wq1dczvbm',
        },
        component: {
          created_at: '2013-05-29T21:32:28Z',
          id: 'rb5wq1dczvbm',
          name: 'Some Component',
          status: 'operational',
        },
      };

      const isValid = await parser.validate(payload);
      expect(isValid).toBe(true);
    });

    it('should reject invalid payload missing required fields', async () => {
      const payload = {
        meta: {},
        page: {},
      };

      const isValid = await parser.validate(payload);
      expect(isValid).toBe(false);
    });

    it('should reject payload without page.id', async () => {
      const payload = {
        meta: {
          unsubscribe: 'http://example.com/unsubscribe',
          documentation: 'http://example.com/docs',
        },
        page: {
          status_indicator: 'critical',
        },
        incident: {},
      };

      const isValid = await parser.validate(payload);
      expect(isValid).toBe(false);
    });

    it('should reject null payload', async () => {
      const isValid = await parser.validate(null);
      expect(isValid).toBe(false);
    });
  });

  describe('parse - Incident', () => {
    it('should parse incident with critical status and updates', async () => {
      const payload: StatuspageIncidentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'critical',
          status_description: 'Major System Outage',
        },
        incident: {
          backfilled: false,
          created_at: '2013-05-29T15:08:51-06:00',
          impact: 'critical',
          impact_override: null,
          monitoring_at: '2013-05-29T16:07:53-06:00',
          name: 'Virginia Is Down',
          resolved_at: null,
          status: 'investigating',
          updated_at: '2013-05-29T16:30:35-06:00',
          id: 'lbkhbwn21v5q',
          organization_id: 'j2mfxwj97wnj',
          shortlink: 'http://j.mp/18zyDQx',
          scheduled_for: null,
          scheduled_until: null,
          scheduled_auto_transition: false,
          scheduled_remind_prior: false,
          scheduled_reminded_at: null,
          postmortem_body: null,
          postmortem_body_last_updated_at: null,
          postmortem_ignored: false,
          postmortem_notified_subscribers: false,
          postmortem_notified_twitter: false,
          postmortem_published_at: null,
          incident_updates: [
            {
              id: 'drfcwbnpxnr6',
              incident_id: 'lbkhbwn21v5q',
              body: 'A fix has been implemented and we are monitoring the results.',
              status: 'monitoring',
              created_at: '2013-05-29T16:07:53-06:00',
              updated_at: '2013-05-29T16:09:09-06:00',
              display_at: '2013-05-29T16:07:53-06:00',
              wants_twitter_update: false,
              twitter_updated_at: null,
            },
          ],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('🚨');
      expect(result.title).toContain('Incident');
      expect(result.title).toContain('Virginia Is Down');
      expect(result.body).toContain('🔍 Investigating');
      expect(result.body).toContain('🚨 Critical');
      expect(result.body).toContain('A fix has been implemented');
      expect(result.body).toContain('View Incident');
      expect(result.body).toContain('http://j.mp/18zyDQx');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
      expect(result.bucketId).toBe('');
    });

    it('should parse resolved incident with normal priority', async () => {
      const payload: StatuspageIncidentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'none',
          status_description: 'All Systems Operational',
        },
        incident: {
          backfilled: false,
          created_at: '2013-05-29T15:08:51-06:00',
          impact: 'major',
          impact_override: null,
          monitoring_at: '2013-05-29T16:07:53-06:00',
          name: 'Database Connection Issues',
          resolved_at: '2013-05-29T17:00:00-06:00',
          status: 'resolved',
          updated_at: '2013-05-29T17:00:00-06:00',
          id: 'lbkhbwn21v5q',
          organization_id: 'j2mfxwj97wnj',
          shortlink: 'http://j.mp/18zyDQx',
          scheduled_for: null,
          scheduled_until: null,
          scheduled_auto_transition: false,
          scheduled_remind_prior: false,
          scheduled_reminded_at: null,
          postmortem_body: null,
          postmortem_body_last_updated_at: null,
          postmortem_ignored: false,
          postmortem_notified_subscribers: false,
          postmortem_notified_twitter: false,
          postmortem_published_at: null,
          incident_updates: [],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('Incident');
      expect(result.body).toContain('✅ Resolved');
      expect(result.body).toContain('🔴 Major');
      expect(result.body).toContain('Resolved:');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse identified incident with critical priority', async () => {
      const payload: StatuspageIncidentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'major',
          status_description: 'System Issues',
        },
        incident: {
          backfilled: false,
          created_at: '2013-05-29T15:08:51-06:00',
          impact: 'minor',
          impact_override: null,
          monitoring_at: null,
          name: 'API Slowdown',
          resolved_at: null,
          status: 'identified',
          updated_at: '2013-05-29T15:30:00-06:00',
          id: 'lbkhbwn21v5q',
          organization_id: 'j2mfxwj97wnj',
          shortlink: 'http://j.mp/18zyDQx',
          scheduled_for: null,
          scheduled_until: null,
          scheduled_auto_transition: false,
          scheduled_remind_prior: false,
          scheduled_reminded_at: null,
          postmortem_body: null,
          postmortem_body_last_updated_at: null,
          postmortem_ignored: false,
          postmortem_notified_subscribers: false,
          postmortem_notified_twitter: false,
          postmortem_published_at: null,
          incident_updates: [],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('Incident');
      expect(result.body).toContain('⚠️ Identified');
      expect(result.body).toContain('⚠️ Minor');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse monitoring incident with normal priority', async () => {
      const payload: StatuspageIncidentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'minor',
          status_description: 'Minor Issues',
        },
        incident: {
          backfilled: false,
          created_at: '2013-05-29T15:08:51-06:00',
          impact: 'none',
          impact_override: null,
          monitoring_at: '2013-05-29T16:07:53-06:00',
          name: 'Test Incident',
          resolved_at: null,
          status: 'monitoring',
          updated_at: '2013-05-29T16:30:35-06:00',
          id: 'lbkhbwn21v5q',
          organization_id: 'j2mfxwj97wnj',
          shortlink: 'http://j.mp/18zyDQx',
          scheduled_for: null,
          scheduled_until: null,
          scheduled_auto_transition: false,
          scheduled_remind_prior: false,
          scheduled_reminded_at: null,
          postmortem_body: null,
          postmortem_body_last_updated_at: null,
          postmortem_ignored: false,
          postmortem_notified_subscribers: false,
          postmortem_notified_twitter: false,
          postmortem_published_at: null,
          incident_updates: [],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('Incident');
      expect(result.body).toContain('👁️ Monitoring');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });

  describe('parse - Component Update', () => {
    it('should parse component update from major_outage to operational', async () => {
      const payload: StatuspageComponentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'major',
          status_description: 'Partial System Outage',
        },
        component_update: {
          created_at: '2013-05-29T21:32:28Z',
          new_status: 'operational',
          old_status: 'major_outage',
          id: 'k7730b5v92bv',
          component_id: 'rb5wq1dczvbm',
        },
        component: {
          created_at: '2013-05-29T21:32:28Z',
          id: 'rb5wq1dczvbm',
          name: 'API Server',
          status: 'operational',
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('✅');
      expect(result.title).toContain('Component Update');
      expect(result.title).toContain('API Server');
      expect(result.body).toContain('🚨 Major Outage');
      expect(result.body).toContain('✅ Operational');
      expect(result.body).toContain('→');
      expect(result.body).toContain('Partial System Outage');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse component update with major_outage status as critical', async () => {
      const payload: StatuspageComponentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'critical',
          status_description: 'Major System Outage',
        },
        component_update: {
          created_at: '2013-05-29T21:32:28Z',
          new_status: 'major_outage',
          old_status: 'operational',
          id: 'k7730b5v92bv',
          component_id: 'rb5wq1dczvbm',
        },
        component: {
          created_at: '2013-05-29T21:32:28Z',
          id: 'rb5wq1dczvbm',
          name: 'Database',
          status: 'major_outage',
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('🚨');
      expect(result.title).toContain('Component Update');
      expect(result.title).toContain('Database');
      expect(result.body).toContain('🚨 Major Outage');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse component update with partial_outage status as critical', async () => {
      const payload: StatuspageComponentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'major',
          status_description: 'Partial Outage',
        },
        component_update: {
          created_at: '2013-05-29T21:32:28Z',
          new_status: 'partial_outage',
          old_status: 'degraded_performance',
          id: 'k7730b5v92bv',
          component_id: 'rb5wq1dczvbm',
        },
        component: {
          created_at: '2013-05-29T21:32:28Z',
          id: 'rb5wq1dczvbm',
          name: 'CDN',
          status: 'partial_outage',
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('🔴');
      expect(result.title).toContain('Component Update');
      expect(result.title).toContain('CDN');
      expect(result.body).toContain('🔴 Partial Outage');
      expect(result.body).toContain('⚠️ Degraded Performance');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse component update with degraded_performance', async () => {
      const payload: StatuspageComponentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'minor',
          status_description: 'Minor Performance Issues',
        },
        component_update: {
          created_at: '2013-05-29T21:32:28Z',
          new_status: 'degraded_performance',
          old_status: 'operational',
          id: 'k7730b5v92bv',
          component_id: 'rb5wq1dczvbm',
        },
        component: {
          created_at: '2013-05-29T21:32:28Z',
          id: 'rb5wq1dczvbm',
          name: 'Web Server',
          status: 'degraded_performance',
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('⚠️');
      expect(result.title).toContain('Component Update');
      expect(result.body).toContain('⚠️ Degraded Performance');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse component update under_maintenance', async () => {
      const payload: StatuspageComponentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'maintenance',
          status_description: 'Under Maintenance',
        },
        component_update: {
          created_at: '2013-05-29T21:32:28Z',
          new_status: 'under_maintenance',
          old_status: 'operational',
          id: 'k7730b5v92bv',
          component_id: 'rb5wq1dczvbm',
        },
        component: {
          created_at: '2013-05-29T21:32:28Z',
          id: 'rb5wq1dczvbm',
          name: 'Backup System',
          status: 'under_maintenance',
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('🔧');
      expect(result.title).toContain('Component Update');
      expect(result.body).toContain('🔧 Under Maintenance');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });

  describe('parse - Edge cases', () => {
    it('should handle incident with empty updates array', async () => {
      const payload: StatuspageIncidentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'critical',
          status_description: 'Issues detected',
        },
        incident: {
          backfilled: false,
          created_at: '2023-10-20T10:00:00Z',
          impact: 'major',
          impact_override: null,
          monitoring_at: null,
          name: 'Test Incident',
          resolved_at: null,
          status: 'investigating',
          updated_at: '2023-10-20T10:00:00Z',
          id: 'incident123',
          organization_id: 'org123',
          shortlink: 'http://j.mp/test',
          scheduled_for: null,
          scheduled_until: null,
          scheduled_auto_transition: false,
          scheduled_remind_prior: false,
          scheduled_reminded_at: null,
          postmortem_body: null,
          postmortem_body_last_updated_at: null,
          postmortem_ignored: false,
          postmortem_notified_subscribers: false,
          postmortem_notified_twitter: false,
          postmortem_published_at: null,
          incident_updates: [],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('Incident');
      expect(result.body).toContain('🔍 Investigating');
      expect(result.body).not.toContain('Latest Update:');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should handle incident without shortlink', async () => {
      const payload: StatuspageIncidentWebhook = {
        meta: {
          unsubscribe: 'http://statustest.example.com/?unsubscribe=j0vqr9kl3513',
          documentation: 'http://doers.statuspage.io/customer-notifications/webhooks/',
        },
        page: {
          id: 'j2mfxwj97wnj',
          status_indicator: 'minor',
          status_description: 'Minor issues',
        },
        incident: {
          backfilled: false,
          created_at: '2023-10-20T10:00:00Z',
          impact: 'none',
          impact_override: null,
          monitoring_at: null,
          name: 'Test Incident',
          resolved_at: null,
          status: 'monitoring',
          updated_at: '2023-10-20T10:00:00Z',
          id: 'incident123',
          organization_id: 'org123',
          shortlink: '',
          scheduled_for: null,
          scheduled_until: null,
          scheduled_auto_transition: false,
          scheduled_remind_prior: false,
          scheduled_reminded_at: null,
          postmortem_body: null,
          postmortem_body_last_updated_at: null,
          postmortem_ignored: false,
          postmortem_notified_subscribers: false,
          postmortem_notified_twitter: false,
          postmortem_published_at: null,
          incident_updates: [],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('Incident');
      expect(result.body).not.toContain('View Incident');
      expect(result.body).toContain('Status Page');
    });
  });
});

