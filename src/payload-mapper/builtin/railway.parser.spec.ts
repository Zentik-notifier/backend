import { RailwayParser, RailwayWebhookPayload } from './railway.parser';
import { NotificationDeliveryType } from '../../notifications/notifications.types';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';

describe('RailwayParser', () => {
  let parser: RailwayParser;

  beforeEach(() => {
    parser = new RailwayParser();
  });

  it('should be defined', async () => {
    expect(parser).toBeDefined();
  });

  it('should have correct metadata', async () => {
    expect(parser.name).toBe('ZentikRailway');
    expect(parser.builtInType).toBe(PayloadMapperBuiltInType.ZENTIK_RAILWAY);
    expect(parser.description).toBe(
      'Parser for Railway webhooks - handles deployment and alert events',
    );
  });

  describe('validate', () => {
    it('should validate correct Railway webhook payload', async () => {
      const payload: RailwayWebhookPayload = {
        type: 'DEPLOY',
        project: {
          id: 'a418f086-cacf-432f-b209-334e17397ae2',
          name: 'Zentik notifier',
          description: 'Test project',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        service: {
          id: 'bece679c-d79e-4895-84c0-aad3c62ea70c',
          name: 'Docs',
        },
        environment: {
          id: '4af5f898-f125-46a2-bd11-acfb0b7760d7',
          name: 'production',
        },
        status: 'BUILDING',
        timestamp: '2025-09-21T08:36:24.208Z',
        deployment: {
          id: '39380b1e-40a3-4c41-b1ea-3972f5406945',
          creator: {
            id: '4eb5aac7-8e08-4768-8dcb-1ff1064ff206',
            name: 'Test User',
            avatar: 'https://avatars.githubusercontent.com/u/23080650?v=4',
          },
          meta: {
            buildOnly: false,
            reason: 'deploy',
            runtime: 'V2',
          },
        },
      };

      expect(await parser.validate(payload, {})).toBe(true);
    });

    it('should reject invalid payloads', async () => {
      expect(await parser.validate(null, {})).toBe(false);
      expect(await parser.validate(undefined, {})).toBe(false);
      expect(await parser.validate({}, {})).toBe(false);
      expect(await parser.validate({ type: 'DEPLOY' }, {})).toBe(false);
      expect(
        await parser.validate({
          type: 'DEPLOY',
          status: 'BUILDING',
        }, {}),
      ).toBe(false);
    });

    it('should validate minimal valid payload', async () => {
      const minimalPayload = {
        type: 'DEPLOY',
        project: {
          id: 'proj_test',
          name: 'test-project',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        environment: {
          id: 'env_test',
          name: 'production',
        },
        timestamp: '2025-09-21T08:36:24.208Z',
      };

      expect(await parser.validate(minimalPayload, {})).toBe(true);
    });

    it('should validate payload without service', async () => {
      const payloadWithoutService = {
        type: 'DEPLOY',
        project: {
          id: 'proj_test',
          name: 'test-project',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        environment: {
          id: 'env_test',
          name: 'production',
        },
        timestamp: '2025-09-21T08:36:24.208Z',
      };

      expect(await parser.validate(payloadWithoutService, {})).toBe(true);
    });

    it('should validate payload without status', async () => {
      const payloadWithoutStatus = {
        type: 'DEPLOY',
        project: {
          id: 'proj_test',
          name: 'test-project',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        service: {
          id: 'service_test',
          name: 'test-service',
        },
        environment: {
          id: 'env_test',
          name: 'production',
        },
        timestamp: '2025-09-21T08:36:24.208Z',
      };

      expect(await parser.validate(payloadWithoutStatus, {})).toBe(true);
    });

    it('should validate real Railway payload', async () => {
      const realPayload = {
        type: 'DEPLOY',
        project: {
          id: 'a418f086-cacf-432f-b209-334e17397ae2',
          name: 'Zentik notifier',
          description: '',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        deployment: {
          id: 'c1019898-5716-49d9-be27-b027cfffd094',
          meta: {
            logsV2: true,
            reason: 'deploy',
            runtime: 'V2',
          },
          creator: {
            id: '4eb5aac7-8e08-4768-8dcb-1ff1064ff206',
            name: null,
            avatar: 'https://avatars.githubusercontent.com/u/23080650?v=4',
          },
        },
        environment: {
          id: '4af5f898-f125-46a2-bd11-acfb0b7760d7',
          name: 'production',
        },
        status: 'BUILDING',
        timestamp: '2025-09-21T08:50:20.066Z',
        service: {
          id: 'bece679c-d79e-4895-84c0-aad3c62ea70c',
          name: 'Docs',
        },
      };

      expect(await parser.validate(realPayload, {})).toBe(true);
    });
  });

  describe('parse', () => {
    it('should parse DEPLOY event correctly', async () => {
      const payload: RailwayWebhookPayload = {
        type: 'DEPLOY',
        project: {
          id: 'a418f086-cacf-432f-b209-334e17397ae2',
          name: 'Zentik notifier',
          description: 'Test project',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        service: {
          id: 'bece679c-d79e-4895-84c0-aad3c62ea70c',
          name: 'Backend',
        },
        environment: {
          id: '4af5f898-f125-46a2-bd11-acfb0b7760d7',
          name: 'production',
        },
        status: 'SUCCESS',
        timestamp: '2025-09-21T08:36:24.208Z',
        deployment: {
          id: 'deploy_12345',
          creator: {
            id: '4eb5aac7-8e08-4768-8dcb-1ff1064ff206',
            name: 'Test User',
            avatar: 'https://avatars.githubusercontent.com/u/23080650?v=4',
          },
          meta: {
            buildOnly: false,
            reason: 'deploy',
            runtime: 'V2',
          },
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toBe('Zentik notifier - Backend');
      expect(result.subtitle).toBe('DEPLOY - SUCCESS');
      expect(result.body).toContain('Project: Zentik notifier');
      expect(result.body).toContain('Service: Backend');
      expect(result.body).toContain('Environment: production');
      expect(result.body).toContain('Started by: Test User');
      expect(result.body).toContain('Deployment ID: deploy_12345');
      expect(result.body).toContain('Timestamp:');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
      expect(result.bucketId).toBe('');
    });

    it('should parse payload without deployment creator', async () => {
      const payload: RailwayWebhookPayload = {
        type: 'DEPLOY',
        project: {
          id: 'a418f086-cacf-432f-b209-334e17397ae2',
          name: 'Test App',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        service: {
          id: 'bece679c-d79e-4895-84c0-aad3c62ea70c',
          name: 'Frontend',
        },
        environment: {
          id: '4af5f898-f125-46a2-bd11-acfb0b7760d7',
          name: 'staging',
        },
        status: 'BUILDING',
        timestamp: '2025-09-21T08:36:24.208Z',
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toBe('Test App - Frontend');
      expect(result.subtitle).toBe('DEPLOY - BUILDING');
      expect(result.body).toContain('Project: Test App');
      expect(result.body).toContain('Service: Frontend');
      expect(result.body).toContain('Environment: staging');
      expect(result.body).not.toContain('Started by:');
      expect(result.body).not.toContain('Deployment ID:');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should set CRITICAL priority for failed deployments', async () => {
      const payload: RailwayWebhookPayload = {
        type: 'DEPLOY',
        project: {
          id: 'a418f086-cacf-432f-b209-334e17397ae2',
          name: 'Test App',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        service: {
          id: 'bece679c-d79e-4895-84c0-aad3c62ea70c',
          name: 'Backend',
        },
        environment: {
          id: '4af5f898-f125-46a2-bd11-acfb0b7760d7',
          name: 'production',
        },
        status: 'FAILED',
        timestamp: '2025-09-21T08:36:24.208Z',
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toBe('Test App - Backend');
      expect(result.subtitle).toBe('DEPLOY - FAILED');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse payload without service name', async () => {
      const payload: RailwayWebhookPayload = {
        type: 'DEPLOY',
        project: {
          id: 'a418f086-cacf-432f-b209-334e17397ae2',
          name: 'Test App',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        environment: {
          id: '4af5f898-f125-46a2-bd11-acfb0b7760d7',
          name: 'production',
        },
        status: 'SUCCESS',
        timestamp: '2025-09-21T08:36:24.208Z',
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toBe('Test App');
      expect(result.subtitle).toBe('DEPLOY - SUCCESS');
      expect(result.body).toContain('Project: Test App');
      expect(result.body).not.toContain('Service:');
      expect(result.body).toContain('Environment: production');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse payload without status', async () => {
      const payload: RailwayWebhookPayload = {
        type: 'DEPLOY',
        project: {
          id: 'a418f086-cacf-432f-b209-334e17397ae2',
          name: 'Test App',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        service: {
          id: 'bece679c-d79e-4895-84c0-aad3c62ea70c',
          name: 'Backend',
        },
        environment: {
          id: '4af5f898-f125-46a2-bd11-acfb0b7760d7',
          name: 'production',
        },
        timestamp: '2025-09-21T08:36:24.208Z',
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toBe('Test App - Backend');
      expect(result.subtitle).toBe('DEPLOY');
      expect(result.body).toContain('Project: Test App');
      expect(result.body).toContain('Service: Backend');
      expect(result.body).toContain('Environment: production');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse real Railway payload', async () => {
      const realPayload = {
        type: 'DEPLOY',
        project: {
          id: 'a418f086-cacf-432f-b209-334e17397ae2',
          name: 'Zentik notifier',
          description: '',
          createdAt: '2025-08-25T22:37:27.337Z',
        },
        deployment: {
          id: 'c1019898-5716-49d9-be27-b027cfffd094',
          meta: {
            logsV2: true,
            reason: 'deploy',
            runtime: 'V2',
          },
          creator: {
            id: '4eb5aac7-8e08-4768-8dcb-1ff1064ff206',
            name: null,
            avatar: 'https://avatars.githubusercontent.com/u/23080650?v=4',
          },
        },
        environment: {
          id: '4af5f898-f125-46a2-bd11-acfb0b7760d7',
          name: 'production',
        },
        status: 'BUILDING',
        timestamp: '2025-09-21T08:50:20.066Z',
        service: {
          id: 'bece679c-d79e-4895-84c0-aad3c62ea70c',
          name: 'Docs',
        },
      };

      const result = await parser.parse(realPayload as any, {});

      expect(result.title).toBe('Zentik notifier - Docs');
      expect(result.subtitle).toBe('DEPLOY - BUILDING');
      expect(result.body).toContain('Project: Zentik notifier');
      expect(result.body).toContain('Service: Docs');
      expect(result.body).toContain('Environment: production');
      expect(result.body).toContain(
        'Deployment ID: c1019898-5716-49d9-be27-b027cfffd094',
      );
      expect(result.body).not.toContain('Started by:'); // creator.name is null
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle errors gracefully', async () => {
      const invalidPayload = { invalid: 'data' };

      const result = await parser.parse(invalidPayload as any, {});

      expect(result.title).toBe('❌ Railway webhook parsing error');
      expect(result.subtitle).toBe('Parser ZentikRailway');
      expect(result.body).toContain(
        'An error occurred while parsing the Railway payload',
      );
      expect(result.body).toContain('"invalid": "data"');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('getTestPayload', () => {
    it('should return a valid test payload', async () => {
      const testPayload = parser.getTestPayload();

      expect(await parser.validate(testPayload, {})).toBe(true);
      expect(testPayload.type).toBe('DEPLOY');
      expect(testPayload.project.name).toBe('Zentik notifier');
      expect(testPayload.environment.name).toBe('production');
      expect(testPayload.service?.name).toBe('Docs');
      expect(testPayload.deployment?.creator?.name).toBe('Test User');
    });

    it('should parse test payload successfully', async () => {
      const testPayload = parser.getTestPayload();
      const result = await parser.parse(testPayload, {});

      expect(result.title).toBe('Zentik notifier - Docs');
      expect(result.subtitle).toBe('DEPLOY - BUILDING');
      expect(result.body).toContain('Zentik notifier');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });
});
