import { InstatusParser, InstatusIncidentWebhook, InstatusMaintenanceWebhook, InstatusComponentWebhook } from './instatus.parser';
import { NotificationDeliveryType } from '../../notifications/notifications.types';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';

describe('InstatusParser', () => {
  let parser: InstatusParser;

  beforeEach(() => {
    parser = new InstatusParser();
  });

  describe('Metadata', () => {
    it('should have correct name', () => {
      expect(parser.name).toBe('Instatus');
    });

    it('should have correct builtInType', () => {
      expect(parser.builtInType).toBe(PayloadMapperBuiltInType.ZENTIK_INSTATUS);
    });

    it('should have correct description', () => {
      expect(parser.description).toBe('Parser for Instatus webhooks - handles incidents, maintenance events, and component updates');
    });
  });

  describe('validate', () => {
    it('should validate a valid incident payload', async () => {
      const payload: InstatusIncidentWebhook = {
        meta: {
          unsubscribe: 'https://example.com/unsubscribe',
          documentation: 'https://instatus.com/help/webhooks',
        },
        page: {
          id: 'page123',
          status_indicator: 'HASISSUES',
          status_description: 'Some systems are experiencing issues',
          url: 'https://status.example.com',
        },
        incident: {
          backfilled: false,
          created_at: '2023-10-20T10:00:00Z',
          impact: 'PARTIALOUTAGE',
          name: 'Database Connection Issues',
          resolved_at: '',
          status: 'INVESTIGATING',
          updated_at: '2023-10-20T10:30:00Z',
          id: 'incident123',
          url: 'https://status.example.com/incidents/incident123',
          incident_updates: [],
        },
      };

      const isValid = await parser.validate(payload);
      expect(isValid).toBe(true);
    });

    it('should validate a valid maintenance payload', async () => {
      const payload: InstatusMaintenanceWebhook = {
        meta: {
          unsubscribe: 'https://example.com/unsubscribe',
          documentation: 'https://instatus.com/help/webhooks',
        },
        page: {
          id: 'page123',
          status_indicator: 'UNDERMAINTENANCE',
          status_description: 'Scheduled maintenance in progress',
          url: 'https://status.example.com',
        },
        maintenance: {
          backfilled: false,
          created_at: '2023-10-20T10:00:00Z',
          impact: 'MINOROUTAGE',
          name: 'Database Upgrade',
          resolved_at: '',
          status: 'INPROGRESS',
          updated_at: '2023-10-20T10:30:00Z',
          id: 'maintenance123',
          url: 'https://status.example.com/maintenances/maintenance123',
          duration: '2 hours',
          maintenance_updates: [],
        },
      };

      const isValid = await parser.validate(payload);
      expect(isValid).toBe(true);
    });

    it('should validate a valid component update payload', async () => {
      const payload: InstatusComponentWebhook = {
        meta: {
          unsubscribe: 'https://example.com/unsubscribe',
          documentation: 'https://instatus.com/help/webhooks',
        },
        page: {
          id: 'page123',
          status_indicator: 'UP',
          status_description: 'All systems operational',
          url: 'https://status.example.com',
        },
        component_update: {
          created_at: '2023-10-20T10:00:00Z',
          new_status: 'OPERATIONAL',
          component_id: 'comp123',
        },
        component: {
          created_at: '2023-01-01T00:00:00Z',
          id: 'comp123',
          name: 'API Server',
          status: 'OPERATIONAL',
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

    it('should reject null payload', async () => {
      const isValid = await parser.validate(null);
      expect(isValid).toBe(false);
    });
  });

  describe('parse - Incident', () => {
    it('should parse incident with critical status', async () => {
      const payload: InstatusIncidentWebhook = {
        meta: {
          unsubscribe: 'https://example.com/unsubscribe',
          documentation: 'https://instatus.com/help/webhooks',
        },
        page: {
          id: 'page123',
          status_indicator: 'HASISSUES',
          status_description: 'Some systems are experiencing issues',
          url: 'https://status.example.com',
        },
        incident: {
          backfilled: false,
          created_at: '2023-10-20T10:00:00Z',
          impact: 'MAJOROUTAGE',
          name: 'Database Connection Issues',
          resolved_at: '',
          status: 'INVESTIGATING',
          updated_at: '2023-10-20T10:30:00Z',
          id: 'incident123',
          url: 'https://status.example.com/incidents/incident123',
          incident_updates: [
            {
              id: 'update1',
              incident_id: 'incident123',
              body: 'We are currently investigating database connection issues affecting multiple services.',
              status: 'INVESTIGATING',
              created_at: '2023-10-20T10:00:00Z',
              updated_at: '2023-10-20T10:00:00Z',
            },
          ],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('🚨');
      expect(result.title).toContain('Incident');
      expect(result.title).toContain('Database Connection Issues');
      expect(result.body).toContain('🔍 Investigating');
      expect(result.body).toContain('Majoroutage');
      expect(result.body).toContain('We are currently investigating');
      expect(result.body).toContain('View Incident');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
      expect(result.bucketId).toBe('');
    });

    it('should parse resolved incident with normal priority', async () => {
      const payload: InstatusIncidentWebhook = {
        meta: {
          unsubscribe: 'https://example.com/unsubscribe',
          documentation: 'https://instatus.com/help/webhooks',
        },
        page: {
          id: 'page123',
          status_indicator: 'UP',
          status_description: 'All systems operational',
          url: 'https://status.example.com',
        },
        incident: {
          backfilled: false,
          created_at: '2023-10-20T10:00:00Z',
          impact: 'MAJOROUTAGE',
          name: 'Database Connection Issues',
          resolved_at: '2023-10-20T11:00:00Z',
          status: 'RESOLVED',
          updated_at: '2023-10-20T11:00:00Z',
          id: 'incident123',
          url: 'https://status.example.com/incidents/incident123',
          incident_updates: [],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('Incident');
      expect(result.body).toContain('✅ Resolved');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });

  describe('parse - Maintenance', () => {
    it('should parse scheduled maintenance', async () => {
      const payload: InstatusMaintenanceWebhook = {
        meta: {
          unsubscribe: 'https://example.com/unsubscribe',
          documentation: 'https://instatus.com/help/webhooks',
        },
        page: {
          id: 'page123',
          status_indicator: 'UNDERMAINTENANCE',
          status_description: 'Scheduled maintenance',
          url: 'https://status.example.com',
        },
        maintenance: {
          backfilled: false,
          created_at: '2023-10-20T10:00:00Z',
          impact: 'MINOROUTAGE',
          name: 'Database Upgrade',
          resolved_at: '',
          status: 'INPROGRESS',
          updated_at: '2023-10-20T10:30:00Z',
          id: 'maintenance123',
          url: 'https://status.example.com/maintenances/maintenance123',
          duration: '2 hours',
          maintenance_updates: [
            {
              id: 'update1',
              maintenance_id: 'maintenance123',
              body: 'Starting database upgrade process.',
              status: 'INPROGRESS',
              created_at: '2023-10-20T10:00:00Z',
              updated_at: '2023-10-20T10:00:00Z',
            },
          ],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('🔧');
      expect(result.title).toContain('Maintenance');
      expect(result.title).toContain('Database Upgrade');
      expect(result.body).toContain('🔄 In Progress');
      expect(result.body).toContain('Minoroutage');
      expect(result.body).toContain('2 hours');
      expect(result.body).toContain('Starting database upgrade');
      expect(result.body).toContain('View Maintenance');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
      expect(result.bucketId).toBe('');
    });
  });

  describe('parse - Component Update', () => {
    it('should parse component update with critical status', async () => {
      const payload: InstatusComponentWebhook = {
        meta: {
          unsubscribe: 'https://example.com/unsubscribe',
          documentation: 'https://instatus.com/help/webhooks',
        },
        page: {
          id: 'page123',
          status_indicator: 'HASISSUES',
          status_description: 'Some components are degraded',
          url: 'https://status.example.com',
        },
        component_update: {
          created_at: '2023-10-20T10:00:00Z',
          new_status: 'MAJOROUTAGE',
          component_id: 'comp123',
        },
        component: {
          created_at: '2023-01-01T00:00:00Z',
          id: 'comp123',
          name: 'API Server',
          status: 'MAJOROUTAGE',
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('🚨');
      expect(result.title).toContain('Component Update');
      expect(result.title).toContain('API Server');
      expect(result.body).toContain('🚨 Major Outage');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse component update with operational status', async () => {
      const payload: InstatusComponentWebhook = {
        meta: {
          unsubscribe: 'https://example.com/unsubscribe',
          documentation: 'https://instatus.com/help/webhooks',
        },
        page: {
          id: 'page123',
          status_indicator: 'UP',
          status_description: 'All systems operational',
          url: 'https://status.example.com',
        },
        component_update: {
          created_at: '2023-10-20T10:00:00Z',
          new_status: 'OPERATIONAL',
          component_id: 'comp123',
        },
        component: {
          created_at: '2023-01-01T00:00:00Z',
          id: 'comp123',
          name: 'API Server',
          status: 'OPERATIONAL',
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('✅');
      expect(result.title).toContain('Component Update');
      expect(result.title).toContain('API Server');
      expect(result.body).toContain('✅ Operational');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });

  describe('parse - Edge cases', () => {
    it('should handle incident with empty updates array', async () => {
      const payload: InstatusIncidentWebhook = {
        meta: {
          unsubscribe: 'https://example.com/unsubscribe',
          documentation: 'https://instatus.com/help/webhooks',
        },
        page: {
          id: 'page123',
          status_indicator: 'HASISSUES',
          status_description: 'Issues detected',
          url: 'https://status.example.com',
        },
        incident: {
          backfilled: false,
          created_at: '2023-10-20T10:00:00Z',
          impact: '',
          name: 'Test Incident',
          resolved_at: '',
          status: 'IDENTIFIED',
          updated_at: '2023-10-20T10:00:00Z',
          id: 'incident123',
          url: 'https://status.example.com/incidents/incident123',
          incident_updates: [],
        },
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('Incident');
      expect(result.body).toContain('⚠️ Identified');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });
});

