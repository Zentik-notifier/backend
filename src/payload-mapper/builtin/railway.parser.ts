import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

export interface RailwayWebhookPayload {
  type: string;
  timestamp: string;
  project: {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
  };
  environment: {
    id: string;
    name: string;
  };
  deployment?: {
    id: string;
    creator: {
      id: string;
      name: string;
      avatar?: string;
    };
    meta: Record<string, any>;
  };
}

@Injectable()
export class RailwayParser implements IBuiltinParser {
  get builtInType(): PayloadMapperBuiltInType {
    return PayloadMapperBuiltInType.ZentikRailway;
  }

  get name(): string {
    return 'ZentikRailway';
  }

  get description(): string {
    return 'Parser for Railway webhooks - handles deployment and alert events';
  }

  validate(payload: any): boolean {
    console.log(payload);
    return !!(
      payload &&
      typeof payload === 'object' &&
      payload.type &&
      payload.timestamp &&
      payload.project &&
      payload.environment &&
      typeof payload.project === 'object' &&
      typeof payload.environment === 'object' &&
      payload.project.id &&
      payload.project.name &&
      payload.environment.id &&
      payload.environment.name
    );
  }

  parse(payload: RailwayWebhookPayload): CreateMessageDto {
    try {
      const baseMessage = this.createBaseMessage(payload);
      
      switch (payload.type) {
        case 'DEPLOY':
          return this.createDeploymentMessage(payload, baseMessage);
        case 'ALERT':
          return this.createAlertMessage(payload, baseMessage);
        default:
          return this.createGenericMessage(payload, baseMessage);
      }
    } catch (error) {
      console.error('Errore durante il parsing del payload Railway:', error);
      return this.createErrorMessage(payload);
    }
  }

  private createBaseMessage(payload: RailwayWebhookPayload): Partial<CreateMessageDto> {
    return {
      title: `Railway - ${payload.project.name}`,
      deliveryType: NotificationDeliveryType.NORMAL,
      bucketId: '', // Will be set by the service
    };
  }

  private createDeploymentMessage(
    payload: RailwayWebhookPayload,
    baseMessage: Partial<CreateMessageDto>
  ): CreateMessageDto {
    const deployment = payload.deployment;
    const creator = deployment?.creator;

    let body = `🚀 Deployment completato\n\n`;
    body += `Progetto: ${payload.project.name}\n`;
    body += `Ambiente: ${payload.environment.name}\n`;
    
    if (creator) {
      body += `Avviato da: ${creator.name}\n`;
    }
    
    if (deployment) {
      body += `Deployment ID: ${deployment.id}\n`;
    }
    
    body += `Timestamp: ${new Date(payload.timestamp).toLocaleString('it-IT')}\n`;

    if (payload.project.description) {
      body += `\nDescrizione progetto: ${payload.project.description}`;
    }

    return {
      ...baseMessage,
      title: `🚀 Deployment - ${payload.project.name}`,
      subtitle: `Ambiente: ${payload.environment.name}`,
      body,
      deliveryType: NotificationDeliveryType.NORMAL,
    } as CreateMessageDto;
  }

  private createAlertMessage(
    payload: RailwayWebhookPayload,
    baseMessage: Partial<CreateMessageDto>
  ): CreateMessageDto {
    let body = `⚠️ Alert Railway\n\n`;
    body += `Progetto: ${payload.project.name}\n`;
    body += `Ambiente: ${payload.environment.name}\n`;
    body += `Timestamp: ${new Date(payload.timestamp).toLocaleString('it-IT')}\n`;

    if (payload.project.description) {
      body += `\nDescrizione progetto: ${payload.project.description}`;
    }

    return {
      ...baseMessage,
      title: `⚠️ Alert - ${payload.project.name}`,
      subtitle: `Ambiente: ${payload.environment.name}`,
      body,
      deliveryType: NotificationDeliveryType.CRITICAL,
    } as CreateMessageDto;
  }

  private createGenericMessage(
    payload: RailwayWebhookPayload,
    baseMessage: Partial<CreateMessageDto>
  ): CreateMessageDto {
    let body = `📋 Evento Railway\n\n`;
    body += `Tipo: ${payload.type}\n`;
    body += `Progetto: ${payload.project.name}\n`;
    body += `Ambiente: ${payload.environment.name}\n`;
    body += `Timestamp: ${new Date(payload.timestamp).toLocaleString('it-IT')}\n`;

    if (payload.project.description) {
      body += `\nDescrizione progetto: ${payload.project.description}`;
    }

    return {
      ...baseMessage,
      title: `📋 ${payload.type} - ${payload.project.name}`,
      subtitle: `Ambiente: ${payload.environment.name}`,
      body,
      deliveryType: NotificationDeliveryType.NORMAL,
    } as CreateMessageDto;
  }

  private createErrorMessage(payload: any): CreateMessageDto {
    return {
      title: '❌ Errore parsing Railway webhook',
      subtitle: 'Parser ZentikRailway',
      body: `Si è verificato un errore durante il parsing del payload Railway.\n\nPayload ricevuto:\n${JSON.stringify(payload, null, 2)}`,
      deliveryType: NotificationDeliveryType.CRITICAL,
      bucketId: '',
    } as CreateMessageDto;
  }

  getTestPayload(): RailwayWebhookPayload {
    return {
      type: 'DEPLOY',
      timestamp: '2025-02-01T00:00:00.000Z',
      project: {
        id: 'proj_12345',
        name: 'zentik-notifier',
        description: 'Sistema di notifiche Zentik',
        createdAt: '2025-01-01T00:00:00.000Z'
      },
      environment: {
        id: 'env_67890',
        name: 'production'
      },
      deployment: {
        id: 'deploy_abcde',
        creator: {
          id: 'user_12345',
          name: 'Gianluca Ruocco',
          avatar: 'https://avatar.example.com/user.png'
        },
        meta: {
          branch: 'main',
          commit: 'abc123def456'
        }
      }
    };
  }
}
