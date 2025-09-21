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
        type: 'DEPLOY',
        timestamp: '2025-02-01T00:00:00.000Z',
        project: {
          id: 'proj_12345',
          name: 'zentik-notifier',
          description: 'Sistema di notifiche Zentik',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        environment: {
          id: 'env_67890',
          name: 'production',
        },
        deployment: {
          id: 'deploy_abcde',
          creator: {
            id: 'user_12345',
            name: 'Gianluca Ruocco',
            avatar: 'https://avatar.example.com/user.png',
          },
          meta: {
            branch: 'main',
            commit: 'abc123def456',
          },
        },
      };

      expect(parser.validate(payload)).toBe(true);
    });

    it('should reject invalid payloads', () => {
      expect(parser.validate(null)).toBe(false);
      expect(parser.validate(undefined)).toBe(false);
      expect(parser.validate({})).toBe(false);
      expect(parser.validate({ type: 'DEPLOY' })).toBe(false);
      expect(parser.validate({ 
        type: 'DEPLOY', 
        timestamp: '2025-02-01T00:00:00.000Z' 
      })).toBe(false);
    });

    it('should validate minimal valid payload', () => {
      const minimalPayload = {
        type: 'DEPLOY',
        timestamp: '2025-02-01T00:00:00.000Z',
        project: {
          id: 'proj_12345',
          name: 'test-project',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        environment: {
          id: 'env_67890',
          name: 'production',
        },
      };

      expect(parser.validate(minimalPayload)).toBe(true);
    });
  });

  describe('parse', () => {
    it('should parse DEPLOY event correctly', () => {
      const payload: RailwayWebhookPayload = {
        type: 'DEPLOY',
        timestamp: '2025-02-01T12:00:00.000Z',
        project: {
          id: 'proj_12345',
          name: 'zentik-notifier',
          description: 'Sistema di notifiche Zentik',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        environment: {
          id: 'env_67890',
          name: 'production',
        },
        deployment: {
          id: 'deploy_abcde',
          creator: {
            id: 'user_12345',
            name: 'Gianluca Ruocco',
            avatar: 'https://avatar.example.com/user.png',
          },
          meta: {
            branch: 'main',
            commit: 'abc123def456',
          },
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('🚀 Deployment - zentik-notifier');
      expect(result.subtitle).toBe('Ambiente: production');
      expect(result.body).toContain('🚀 Deployment completato');
      expect(result.body).toContain('Progetto: zentik-notifier');
      expect(result.body).toContain('Ambiente: production');
      expect(result.body).toContain('Avviato da: Gianluca Ruocco');
      expect(result.body).toContain('Deployment ID: deploy_abcde');
      expect(result.body).toContain('Descrizione progetto: Sistema di notifiche Zentik');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
      expect(result.bucketId).toBe('');
    });

    it('should parse ALERT event correctly', () => {
      const payload: RailwayWebhookPayload = {
        type: 'ALERT',
        timestamp: '2025-02-01T12:00:00.000Z',
        project: {
          id: 'proj_12345',
          name: 'zentik-notifier',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        environment: {
          id: 'env_67890',
          name: 'production',
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('⚠️ Alert - zentik-notifier');
      expect(result.subtitle).toBe('Ambiente: production');
      expect(result.body).toContain('⚠️ Alert Railway');
      expect(result.body).toContain('Progetto: zentik-notifier');
      expect(result.body).toContain('Ambiente: production');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse unknown event types as generic', () => {
      const payload: RailwayWebhookPayload = {
        type: 'UNKNOWN_EVENT',
        timestamp: '2025-02-01T12:00:00.000Z',
        project: {
          id: 'proj_12345',
          name: 'zentik-notifier',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        environment: {
          id: 'env_67890',
          name: 'staging',
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('📋 UNKNOWN_EVENT - zentik-notifier');
      expect(result.subtitle).toBe('Ambiente: staging');
      expect(result.body).toContain('📋 Evento Railway');
      expect(result.body).toContain('Tipo: UNKNOWN_EVENT');
      expect(result.body).toContain('Progetto: zentik-notifier');
      expect(result.body).toContain('Ambiente: staging');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle deployment without creator', () => {
      const payload: RailwayWebhookPayload = {
        type: 'DEPLOY',
        timestamp: '2025-02-01T12:00:00.000Z',
        project: {
          id: 'proj_12345',
          name: 'zentik-notifier',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        environment: {
          id: 'env_67890',
          name: 'production',
        },
        deployment: {
          id: 'deploy_abcde',
          creator: {
            id: 'user_12345',
            name: 'Gianluca Ruocco',
          },
          meta: {},
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('🚀 Deployment - zentik-notifier');
      expect(result.body).toContain('Avviato da: Gianluca Ruocco');
      expect(result.body).toContain('Deployment ID: deploy_abcde');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle minimal deployment payload', () => {
      const payload: RailwayWebhookPayload = {
        type: 'DEPLOY',
        timestamp: '2025-02-01T12:00:00.000Z',
        project: {
          id: 'proj_12345',
          name: 'zentik-notifier',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        environment: {
          id: 'env_67890',
          name: 'production',
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('🚀 Deployment - zentik-notifier');
      expect(result.body).toContain('🚀 Deployment completato');
      expect(result.body).toContain('Progetto: zentik-notifier');
      expect(result.body).toContain('Ambiente: production');
      expect(result.body).not.toContain('Avviato da:');
      expect(result.body).not.toContain('Deployment ID:');
    });

    it('should handle errors gracefully', () => {
      const invalidPayload = { invalid: 'data' };

      const result = parser.parse(invalidPayload as any);

      expect(result.title).toBe('❌ Errore parsing Railway webhook');
      expect(result.subtitle).toBe('Parser ZentikRailway');
      expect(result.body).toContain('Si è verificato un errore durante il parsing del payload Railway');
      expect(result.body).toContain('"invalid": "data"');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('getTestPayload', () => {
    it('should return a valid test payload', () => {
      const testPayload = parser.getTestPayload();

      expect(parser.validate(testPayload)).toBe(true);
      expect(testPayload.type).toBe('DEPLOY');
      expect(testPayload.project.name).toBe('zentik-notifier');
      expect(testPayload.environment.name).toBe('production');
      expect(testPayload.deployment?.creator.name).toBe('Gianluca Ruocco');
    });

    it('should parse test payload successfully', () => {
      const testPayload = parser.getTestPayload();
      const result = parser.parse(testPayload);

      expect(result.title).toContain('Deployment');
      expect(result.body).toContain('zentik-notifier');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });
});
