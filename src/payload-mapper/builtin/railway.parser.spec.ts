import { Test, TestingModule } from '@nestjs/testing';
import { RailwayParser, RailwayWebhookPayload } from './railway.parser';
import { NotificationDeliveryType } from '../../notifications/notifications.types';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';

describe('RailwayParser', () => {
  let parser: RailwayParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RailwayParser],
    }).compile();

    parser = module.get<RailwayParser>(RailwayParser);
  });

  it('should be defined', () => {
    expect(parser).toBeDefined();
  });

  it('should have correct metadata', () => {
    expect(parser.name).toBe('ZentikRailway');
    expect(parser.builtInType).toBe(PayloadMapperBuiltInType.ZentikRailway);
    expect(parser.description).toBe('Parser for Railway webhooks - handles deployment and alert events');
  });

  describe('validate', () => {
    it('should validate correct Railway webhook payload', () => {
      const payload: RailwayWebhookPayload = {
        message: "",
        attributes: {
          deployment: {
            creator: {
              avatar: "https://avatars.githubusercontent.com/u/23080650?v=4",
              id: "4eb5aac7-8e08-4768-8dcb-1ff1064ff206",
              name: "Test User"
            },
            id: "39380b1e-40a3-4c41-b1ea-3972f5406945",
            meta: {
              buildOnly: false,
              reason: "deploy",
              runtime: "V2"
            }
          },
          environment: {
            id: "4af5f898-f125-46a2-bd11-acfb0b7760d7",
            name: "production"
          },
          level: "info",
          project: {
            createdAt: "2025-08-25T22:37:27.337Z",
            description: "Test project description",
            id: "a418f086-cacf-432f-b209-334e17397ae2",
            name: "Zentik notifier"
          },
          service: {
            id: "bece679c-d79e-4895-84c0-aad3c62ea70c",
            name: "Docs"
          },
          status: "BUILDING",
          timestamp: "2025-09-21T08:36:24.208Z",
          type: "DEPLOY"
        },
        tags: {
          project: "a418f086-cacf-432f-b209-334e17397ae2",
          environment: "4af5f898-f125-46a2-bd11-acfb0b7760d7",
          service: "8fa5bf4d-573c-4814-8050-d04b17c508de",
          deployment: "55a277c4-0e2a-417e-9a73-0f798f4fe59c",
          replica: "bcac40cf-bf74-4b0f-86f7-dcf28d1210a7"
        },
        timestamp: "2025-09-21T08:36:31.152703801Z"
      };

      expect(parser.validate(payload)).toBe(true);
    });

    it('should reject invalid payloads', () => {
      expect(parser.validate(null)).toBe(false);
      expect(parser.validate(undefined)).toBe(false);
      expect(parser.validate({})).toBe(false);
      expect(parser.validate({ attributes: {} })).toBe(false);
      expect(parser.validate({ 
        attributes: { 
          type: 'DEPLOY', 
          timestamp: '2025-02-01T00:00:00.000Z' 
        } 
      })).toBe(false);
    });

    it('should validate minimal valid payload', () => {
      const minimalPayload = {
        message: "",
        attributes: {
          environment: {
            id: "env_test",
            name: "production"
          },
          level: "info",
          project: {
            createdAt: "2025-08-25T22:37:27.337Z",
            id: "proj_test",
            name: "test-project"
          },
          service: {
            id: "service_test",
            name: "test-service"
          },
          status: "BUILDING",
          timestamp: "2025-09-21T08:36:24.208Z",
          type: "DEPLOY"
        },
        tags: {
          project: "proj_test",
          environment: "env_test",
          service: "service_test"
        },
        timestamp: "2025-09-21T08:36:31.152703801Z"
      };

      expect(parser.validate(minimalPayload)).toBe(true);
    });
  });

  describe('parse', () => {
    it('should parse DEPLOY event correctly', () => {
      const payload: RailwayWebhookPayload = {
        message: "",
        attributes: {
          deployment: {
            creator: {
              avatar: "https://avatars.githubusercontent.com/u/23080650?v=4",
              id: "4eb5aac7-8e08-4768-8dcb-1ff1064ff206",
              name: "Test User"
            },
            id: "deploy_12345",
            meta: {
              buildOnly: false,
              reason: "deploy",
              runtime: "V2"
            }
          },
          environment: {
            id: "env_67890",
            name: "production"
          },
          level: "info",
          project: {
            createdAt: "2025-08-25T22:37:27.337Z",
            description: "Test project description",
            id: "proj_12345",
            name: "Zentik notifier"
          },
          service: {
            id: "service_12345",
            name: "Backend"
          },
          status: "SUCCESS",
          timestamp: "2025-09-21T08:36:24.208Z",
          type: "DEPLOY"
        },
        tags: {
          project: "proj_12345",
          environment: "env_67890",
          service: "service_12345",
          deployment: "deploy_12345"
        },
        timestamp: "2025-09-21T08:36:31.152703801Z"
      };

      const result = parser.parse(payload);

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

    it('should parse payload without deployment creator', () => {
      const payload: RailwayWebhookPayload = {
        message: "",
        attributes: {
          environment: {
            id: "env_67890",
            name: "staging"
          },
          level: "info",
          project: {
            createdAt: "2025-08-25T22:37:27.337Z",
            id: "proj_12345",
            name: "Test App"
          },
          service: {
            id: "service_12345",
            name: "Frontend"
          },
          status: "BUILDING",
          timestamp: "2025-09-21T08:36:24.208Z",
          type: "DEPLOY"
        },
        tags: {
          project: "proj_12345",
          environment: "env_67890",
          service: "service_12345"
        },
        timestamp: "2025-09-21T08:36:31.152703801Z"
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Test App - Frontend');
      expect(result.subtitle).toBe('DEPLOY - BUILDING');
      expect(result.body).toContain('Project: Test App');
      expect(result.body).toContain('Service: Frontend');
      expect(result.body).toContain('Environment: staging');
      expect(result.body).not.toContain('Started by:');
      expect(result.body).not.toContain('Deployment ID:');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should set CRITICAL priority for failed deployments', () => {
      const payload: RailwayWebhookPayload = {
        message: "",
        attributes: {
          environment: {
            id: "env_67890",
            name: "production"
          },
          level: "error",
          project: {
            createdAt: "2025-08-25T22:37:27.337Z",
            id: "proj_12345",
            name: "Test App"
          },
          service: {
            id: "service_12345",
            name: "Backend"
          },
          status: "FAILED",
          timestamp: "2025-09-21T08:36:24.208Z",
          type: "DEPLOY"
        },
        tags: {
          project: "proj_12345",
          environment: "env_67890",
          service: "service_12345"
        },
        timestamp: "2025-09-21T08:36:31.152703801Z"
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Test App - Backend');
      expect(result.subtitle).toBe('DEPLOY - FAILED');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should handle errors gracefully', () => {
      const invalidPayload = { invalid: 'data' };

      const result = parser.parse(invalidPayload as any);

      expect(result.title).toBe('❌ Railway webhook parsing error');
      expect(result.subtitle).toBe('Parser ZentikRailway');
      expect(result.body).toContain('An error occurred while parsing the Railway payload');
      expect(result.body).toContain('"invalid": "data"');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('getTestPayload', () => {
    it('should return a valid test payload', () => {
      const testPayload = parser.getTestPayload();

      expect(parser.validate(testPayload)).toBe(true);
      expect(testPayload.attributes.type).toBe('DEPLOY');
      expect(testPayload.attributes.project.name).toBe('Zentik notifier');
      expect(testPayload.attributes.environment.name).toBe('production');
      expect(testPayload.attributes.service.name).toBe('Docs');
      expect(testPayload.attributes.deployment?.creator.name).toBe('Test User');
    });

    it('should parse test payload successfully', () => {
      const testPayload = parser.getTestPayload();
      const result = parser.parse(testPayload);

      expect(result.title).toBe('Zentik notifier - Docs');
      expect(result.subtitle).toBe('DEPLOY - BUILDING');
      expect(result.body).toContain('Zentik notifier');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });
});