import { StatusIoParser, StatusIoIncidentPayload, StatusIoMaintenancePayload } from './status-io.parser';
import { NotificationDeliveryType } from '../../notifications/notifications.types';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';

describe('StatusIoParser', () => {
  let parser: StatusIoParser;

  beforeEach(() => {
    parser = new StatusIoParser();
  });

  describe('Metadata', () => {
    it('should have correct name', () => {
      expect(parser.name).toBe('Status.io');
    });

    it('should have correct builtInType', () => {
      expect(parser.builtInType).toBe(PayloadMapperBuiltInType.ZENTIK_STATUS_IO);
    });

    it('should have correct description', () => {
      expect(parser.description).toBe('Parser for Status.io webhooks - handles incidents and scheduled maintenance events');
    });
  });

  describe('validate', () => {
    it('should validate a valid incident payload', async () => {
      const payload: StatusIoIncidentPayload = {
        id: '551edb8331a9664b11000005',
        message_id: '531adb8331a9553b11000008',
        title: 'Database Issues',
        datetime: '2015-04-03T18:27:15.344Z',
        datetime_start: '2015-04-03T18:27:15+00:00',
        datetime_resolve: '',
        current_status: 'Degraded Performance',
        current_state: 'Identified',
        previous_status: '',
        previous_state: '',
        infrastructure_affected: [],
        components: [],
        containers: [],
        details: 'A database instance has become unhealthy',
        incident_url: 'https://status.io/pages/incident/5516e01e2e55e4e917000005/5116e01e2e33e4e413000001',
        status_page_url: 'https://status.io/pages/5516e01e2e55e4e917000005',
      };

      const isValid = await parser.validate(payload);
      expect(isValid).toBe(true);
    });

    it('should validate a valid maintenance payload', async () => {
      const payload: StatusIoMaintenancePayload = {
        id: '552adb8331a9553b11000008',
        message_id: '542adb8331a9553b11000008',
        title: 'Server Upgrades',
        datetime: '2015-04-03T18:38:57.326Z',
        datetime_start: '2015-04-03T18:30:00+00:00',
        datetime_end: '2015-04-03T18:45:00+00:00',
        current_status: 'Planned Maintenance',
        infrastructure_affected: [],
        components: [],
        containers: [],
        details: 'We are upgrading servers',
        maintenance_url: 'https://status.io/pages/maintenance/5516e01e2e55e4e917000005/5116e01e2e33e4e413000001',
        status_page_url: 'https://status.io/pages/5516e01e2e55e4e917000005',
      };

      const isValid = await parser.validate(payload);
      expect(isValid).toBe(true);
    });

    it('should reject invalid payload missing required fields', async () => {
      const payload = {
        id: '123',
        title: 'Test',
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
      const payload: StatusIoIncidentPayload = {
        id: '551edb8331a9664b11000005',
        message_id: '531adb8331a9553b11000008',
        title: 'Database Issues',
        datetime: '2015-04-03T18:27:15.344Z',
        datetime_start: '2015-04-03T18:27:15+00:00',
        datetime_resolve: '',
        current_status: 'Major Outage',
        current_state: 'Investigating',
        previous_status: '',
        previous_state: '',
        infrastructure_affected: [],
        components: [
          { name: 'Chat Service', _id: '551ed627b556f14210000005' },
          { name: 'Voice Services', _id: '551ed5f5590f5a3b10000009' },
        ],
        containers: [
          { name: 'Ireland', _id: '5516e01e2e55e4e917000014' },
          { name: 'London', _id: '551ed5d3590f5a3b10000008' },
        ],
        details: 'A database instance has become unhealthy and removed from the cluster.',
        incident_url: 'https://status.io/pages/incident/5516e01e2e55e4e917000005/5116e01e2e33e4e413000001',
        status_page_url: 'https://status.io/pages/5516e01e2e55e4e917000005',
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('🚨');
      expect(result.title).toContain('Incident');
      expect(result.title).toContain('Database Issues');
      expect(result.body).toContain('Major Outage');
      expect(result.body).toContain('Investigating');
      expect(result.body).toContain('database instance has become unhealthy');
      expect(result.body).toContain('Chat Service');
      expect(result.body).toContain('Voice Services');
      expect(result.body).toContain('Ireland');
      expect(result.body).toContain('London');
      expect(result.body).toContain('View Incident');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
      expect(result.bucketId).toBe('');
    });

    it('should parse resolved incident with normal priority', async () => {
      const payload: StatusIoIncidentPayload = {
        id: '551edb8331a9664b11000005',
        message_id: '531adb8331a9553b11000008',
        title: 'Database Issues - Resolved',
        datetime: '2015-04-03T18:27:15.344Z',
        datetime_start: '2015-04-03T18:27:15+00:00',
        datetime_resolve: '2015-04-03T19:00:00+00:00',
        current_status: 'Operational',
        current_state: 'Resolved',
        previous_status: 'Major Outage',
        previous_state: 'Investigating',
        infrastructure_affected: [],
        components: [],
        containers: [],
        details: 'All systems have been restored.',
        incident_url: 'https://status.io/pages/incident/5516e01e2e55e4e917000005/5116e01e2e33e4e413000001',
        status_page_url: 'https://status.io/pages/5516e01e2e55e4e917000005',
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('Incident');
      expect(result.body).toContain('Resolved');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });

  describe('parse - Maintenance', () => {
    it('should parse scheduled maintenance', async () => {
      const payload: StatusIoMaintenancePayload = {
        id: '552adb8331a9553b11000008',
        message_id: '542adb8331a9553b11000008',
        title: 'Server Upgrades',
        datetime: '2015-04-03T18:38:57.326Z',
        datetime_start: '2015-04-03T18:30:00+00:00',
        datetime_end: '2015-04-03T18:45:00+00:00',
        current_status: 'Planned Maintenance',
        infrastructure_affected: [],
        components: [
          { name: 'Web Server', _id: '551ed627b556f14210000005' },
        ],
        containers: [
          { name: 'US East', _id: '551ed5ac590f5a3b10000006' },
          { name: 'US West', _id: '551ed5b1c9f9404110000005' },
        ],
        details: 'We are performing scheduled server upgrades.',
        maintenance_url: 'https://status.io/pages/maintenance/5516e01e2e55e4e917000005/5116e01e2e33e4e413000001',
        status_page_url: 'https://status.io/pages/5516e01e2e55e4e917000005',
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('🔧');
      expect(result.title).toContain('Maintenance');
      expect(result.title).toContain('Server Upgrades');
      expect(result.body).toContain('Planned Maintenance');
      expect(result.body).toContain('scheduled server upgrades');
      expect(result.body).toContain('Web Server');
      expect(result.body).toContain('US East');
      expect(result.body).toContain('US West');
      expect(result.body).toContain('View Maintenance');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
      expect(result.bucketId).toBe('');
    });
  });

  describe('parse - Edge cases', () => {
    it('should handle payload with missing optional fields', async () => {
      const payload: StatusIoMaintenancePayload = {
        id: '552adb8331a9553b11000008',
        message_id: '542adb8331a9553b11000008',
        title: 'Quick Update',
        datetime: '2015-04-03T18:38:57.326Z',
        datetime_start: '2015-04-03T18:30:00+00:00',
        datetime_end: '2015-04-03T18:45:00+00:00',
        current_status: '',
        infrastructure_affected: [],
        components: [],
        containers: [],
        details: 'Brief status update',
        maintenance_url: 'https://status.io/pages/maintenance/test',
        status_page_url: 'https://status.io/pages/test',
      };

      const result = await parser.parse(payload);

      expect(result.title).toContain('Maintenance');
      expect(result.body).toContain('Brief status update');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });
});

