import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

export interface RailwayWebhookPayload {
  type: string;
  project: {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
  };
  service?: {
    id: string;
    name: string;
  };
  environment: {
    id: string;
    name: string;
  };
  status?: string;
  timestamp: string;
  deployment?: {
    id: string;
    creator?: {
      id: string;
      name?: string | null;
      avatar?: string;
    };
    meta?: Record<string, any>;
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
    return !!(
      payload &&
      typeof payload === 'object' &&
      payload.type &&
      payload.project?.name
    );
  }

  parse(payload: RailwayWebhookPayload): CreateMessageDto {
    try {
      return this.createMessage(payload);
    } catch (error) {
      console.error('Error parsing Railway payload:', error);
      return this.createErrorMessage(payload);
    }
  }

  private createMessage(payload: RailwayWebhookPayload): CreateMessageDto {
    const { project, service, environment, type, status, timestamp, deployment } = payload;

    const title = service?.name ? `${project.name} - ${service.name}` : project.name;
    const subtitle = status ? `${type} - ${status}` : type;

    let body = `Project: ${project.name}\n`;
    
    if (service?.name) {
      body += `Service: ${service.name}\n`;
    }

    if (environment) {
      body += `Environment: ${environment.name}\n`;
    }

    if (deployment?.creator?.name) {
      body += `Started by: ${deployment.creator.name}\n`;
    }

    if (deployment?.id) {
      body += `Deployment ID: ${deployment.id}\n`;
    }

    if (timestamp) {
      body += `Timestamp: ${new Date(timestamp).toLocaleString('it-IT')}`;
    }

    const deliveryType = this.getDeliveryType(type, status || '');

    return {
      title,
      subtitle,
      body,
      deliveryType,
      bucketId: '', // Will be set by the service
    } as CreateMessageDto;
  }

  private getDeliveryType(type: string, status: string): NotificationDeliveryType {
    if (status && (status.includes('FAILED') || status.includes('ERROR'))) {
      return NotificationDeliveryType.CRITICAL;
    }

    return NotificationDeliveryType.NORMAL;
  }

  private createErrorMessage(payload: any): CreateMessageDto {
    return {
      title: '❌ Railway webhook parsing error',
      subtitle: 'Parser ZentikRailway',
      body: `An error occurred while parsing the Railway payload.\n\nReceived payload:\n${JSON.stringify(payload, null, 2)}`,
      deliveryType: NotificationDeliveryType.CRITICAL,
      bucketId: '',
    } as CreateMessageDto;
  }

  getTestPayload(): RailwayWebhookPayload {
    return {
      type: "DEPLOY",
      project: {
        id: "a418f086-cacf-432f-b209-334e17397ae2",
        name: "Zentik notifier",
        description: "Test project description",
        createdAt: "2025-08-25T22:37:27.337Z"
      },
      service: {
        id: "bece679c-d79e-4895-84c0-aad3c62ea70c",
        name: "Docs"
      },
      environment: {
        id: "4af5f898-f125-46a2-bd11-acfb0b7760d7",
        name: "production"
      },
      status: "BUILDING",
      timestamp: "2025-09-21T08:36:24.208Z",
      deployment: {
        id: "39380b1e-40a3-4c41-b1ea-3972f5406945",
        creator: {
          id: "4eb5aac7-8e08-4768-8dcb-1ff1064ff206",
          name: "Test User",
          avatar: "https://avatars.githubusercontent.com/u/23080650?v=4"
        },
        meta: {
          buildOnly: false,
          reason: "deploy",
          runtime: "V2"
        }
      }
    };
  }
}
