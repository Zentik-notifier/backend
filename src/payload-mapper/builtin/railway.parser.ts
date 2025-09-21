import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

export interface RailwayWebhookPayload {
  message: string;
  attributes: {
    deployment?: {
      creator: {
        avatar?: string;
        id: string;
        name?: string;
      };
      id: string;
      meta: Record<string, any>;
    };
    environment: {
      id: string;
      name: string;
    };
    level: string;
    project: {
      createdAt: string;
      description?: string;
      id: string;
      name: string;
    };
    service: {
      id: string;
      name: string;
    };
    status: string;
    timestamp: string;
    type: string;
  };
  tags: {
    project: string;
    environment: string;
    service: string;
    deployment?: string;
    replica?: string;
  };
  timestamp: string;
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
      payload.attributes &&
      typeof payload.attributes === 'object' &&
      payload.attributes.type &&
      payload.attributes.timestamp &&
      payload.attributes.project &&
      payload.attributes.environment &&
      payload.attributes.service &&
      payload.attributes.status &&
      typeof payload.attributes.project === 'object' &&
      typeof payload.attributes.environment === 'object' &&
      typeof payload.attributes.service === 'object' &&
      payload.attributes.project.id &&
      payload.attributes.project.name &&
      payload.attributes.environment.id &&
      payload.attributes.environment.name &&
      payload.attributes.service.id &&
      payload.attributes.service.name
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
    const { attributes } = payload;
    const { project, service, environment, type, status, timestamp, deployment } = attributes;
    
    const title = `${project.name} - ${service.name}`;
    const subtitle = `${type} - ${status}`;
    
    let body = `Project: ${project.name}\n`;
    body += `Service: ${service.name}\n`;
    body += `Environment: ${environment.name}\n`;
    
    if (deployment?.creator?.name) {
      body += `Started by: ${deployment.creator.name}\n`;
    }
    
    if (deployment?.id) {
      body += `Deployment ID: ${deployment.id}\n`;
    }
    
    body += `Timestamp: ${new Date(timestamp).toLocaleString('it-IT')}`;

    const deliveryType = this.getDeliveryType(type, status);

    return {
      title,
      subtitle,
      body,
      deliveryType,
      bucketId: '', // Will be set by the service
    } as CreateMessageDto;
  }

  private getDeliveryType(type: string, status: string): NotificationDeliveryType {
    if (status.includes('FAILED') || status.includes('ERROR')) {
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
  }
}
