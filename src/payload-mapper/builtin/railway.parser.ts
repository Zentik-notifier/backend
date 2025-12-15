import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser, ParserOptions } from './builtin-parser.interface';
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
    return PayloadMapperBuiltInType.ZENTIK_RAILWAY;
  }

  get name(): string {
    return 'Railway';
  }

  get description(): string {
    return 'Parser for Railway webhooks - handles deployment and alert events';
  }

  async validate(payload: any, options?: ParserOptions): Promise<boolean> {
    return new Promise(resolve => resolve(this.syncValidate(payload, options)));
  }

  private syncValidate(payload: any, options?: ParserOptions): boolean {
    // Headers are available if needed for future webhook signature verification
    // For now, Railway doesn't require signature verification in this parser

    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const hasType = !!payload.type;

    // Support both old and new Railway webhook formats:
    // - legacy: payload.project?.name
    // - current: payload.resource?.project?.name
    const hasLegacyProject = !!payload.project?.name;
    const hasResourceProject = !!payload.resource?.project?.name;

    return hasType && (hasLegacyProject || hasResourceProject);
  }

  async parse(payload: any, options?: ParserOptions): Promise<CreateMessageDto> {
    return new Promise(resolve => resolve(this.syncParse(payload, options)));
  }

  private syncParse(payload: any, options?: ParserOptions): CreateMessageDto {
    try {
      const normalized = this.normalizePayload(payload);
      return this.createMessage(normalized);
    } catch (error) {
      console.error('Error parsing Railway payload:', error);
      return this.createErrorMessage(payload);
    }
  }

  private normalizePayload(raw: any): RailwayWebhookPayload {
    // Normalize both the old and new Railway webhook formats into a
    // single internal shape used by createMessage.

    const project = raw.project || raw.resource?.project || {};
    const service = raw.service || raw.resource?.service;
    const environment = raw.environment || raw.resource?.environment || {};

    const status: string | undefined =
      raw.status ||
      raw.details?.status ||
      raw.details?.deploymentStatus ||
      undefined;

    const timestamp: string =
      raw.timestamp ||
      raw.time ||
      new Date().toISOString();

    const deploymentId: string | undefined =
      raw.deployment?.id ||
      raw.resource?.deployment?.id ||
      raw.details?.id ||
      undefined;

    const deploymentMeta: Record<string, any> | undefined =
      raw.deployment?.meta ||
      raw.details ||
      undefined;

    const deploymentCreator = raw.deployment?.creator;

    const normalized: RailwayWebhookPayload = {
      type: raw.type,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt || timestamp,
      },
      service: service
        ? {
            id: service.id,
            name: service.name,
          }
        : undefined,
      environment: {
        id: environment.id,
        name: environment.name,
      },
      status,
      timestamp,
      deployment: deploymentId
        ? {
            id: deploymentId,
            creator: deploymentCreator,
            meta: deploymentMeta,
          }
        : undefined,
    };

    return normalized;
  }

  private createMessage(payload: RailwayWebhookPayload): CreateMessageDto {
    const {
      project,
      service,
      environment,
      type,
      status,
      timestamp,
      deployment,
    } = payload;

    const title = service?.name
      ? `${project.name} - ${service.name}`
      : project.name;
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
      body += `Timestamp: ${new Date(timestamp).toLocaleString('it-IT')}\n`;
    }

    // Add links
    if (project.id) {
      const projectUrl = `https://railway.app/project/${project.id}`;
      body += `\n<a href="${projectUrl}">View Project</a>`;
      
      if (service?.id) {
        const serviceUrl = `https://railway.app/project/${project.id}/service/${service.id}`;
        body += ` • <a href="${serviceUrl}">View Service</a>`;
      }
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

  private getDeliveryType(
    type: string,
    status: string,
  ): NotificationDeliveryType {
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
      type: 'DEPLOY',
      project: {
        id: 'a418f086-cacf-432f-b209-334e17397ae2',
        name: 'Zentik notifier',
        description: 'Test project description',
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
  }
}
