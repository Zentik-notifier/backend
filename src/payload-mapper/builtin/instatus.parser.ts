import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser, ParserOptions } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

export interface InstatusMetadata {
  unsubscribe: string;
  documentation: string;
}

export interface InstatusPage {
  id: string;
  status_indicator: string;
  status_description: string;
  url: string;
}

export interface InstatusIncidentUpdate {
  id: string;
  incident_id: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface InstatusIncident {
  backfilled: boolean;
  created_at: string;
  impact: string;
  name: string;
  resolved_at: string;
  status: string;
  updated_at: string;
  id: string;
  url: string;
  incident_updates: InstatusIncidentUpdate[];
}

export interface InstatusMaintenanceUpdate {
  id: string;
  maintenance_id: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface InstatusMaintenance {
  backfilled: boolean;
  created_at: string;
  impact: string;
  name: string;
  resolved_at: string;
  status: string;
  updated_at: string;
  id: string;
  url: string;
  duration: string;
  maintenance_updates: InstatusMaintenanceUpdate[];
}

export interface InstatusComponent {
  created_at: string;
  id: string;
  name: string;
  status: string;
}

export interface InstatusComponentUpdate {
  created_at: string;
  new_status: string;
  component_id: string;
}

export interface InstatusIncidentWebhook {
  meta: InstatusMetadata;
  page: InstatusPage;
  incident: InstatusIncident;
}

export interface InstatusMaintenanceWebhook {
  meta: InstatusMetadata;
  page: InstatusPage;
  maintenance: InstatusMaintenance;
}

export interface InstatusComponentWebhook {
  meta: InstatusMetadata;
  page: InstatusPage;
  component_update: InstatusComponentUpdate;
  component: InstatusComponent;
}

export type InstatusWebhookPayload = InstatusIncidentWebhook | InstatusMaintenanceWebhook | InstatusComponentWebhook;

@Injectable()
export class InstatusParser implements IBuiltinParser {
  get builtInType(): PayloadMapperBuiltInType {
    return PayloadMapperBuiltInType.ZENTIK_INSTATUS;
  }

  get name(): string {
    return 'Instatus';
  }

  get description(): string {
    return 'Parser for Instatus webhooks - handles incidents, maintenance events, and component updates';
  }

  async validate(payload: any, options?: ParserOptions): Promise<boolean> {
    return new Promise(resolve => resolve(this.syncValidate(payload, options)));
  }

  private syncValidate(payload: any, options?: ParserOptions): boolean {
    return !!(
      payload &&
      typeof payload === 'object' &&
      payload.meta &&
      payload.page?.url &&
      (payload.incident || payload.maintenance || payload.component_update)
    );
  }

  async parse(payload: InstatusWebhookPayload, options?: ParserOptions): Promise<CreateMessageDto> {
    return new Promise(resolve => resolve(this.syncParse(payload, options)));
  }

  private syncParse(payload: InstatusWebhookPayload, options?: ParserOptions): CreateMessageDto {
    try {
      return this.createMessage(payload);
    } catch (error) {
      console.error('Error parsing Instatus payload:', error);
      return this.createErrorMessage(payload);
    }
  }

  private createMessage(payload: InstatusWebhookPayload): CreateMessageDto {
    const hasIncident = 'incident' in payload;
    const hasMaintenance = 'maintenance' in payload;
    const hasComponentUpdate = 'component_update' in payload;

    if (hasIncident) {
      return this.createIncidentMessage(payload as InstatusIncidentWebhook);
    } else if (hasMaintenance) {
      return this.createMaintenanceMessage(payload as InstatusMaintenanceWebhook);
    } else if (hasComponentUpdate) {
      return this.createComponentUpdateMessage(payload as InstatusComponentWebhook);
    }

    return this.createErrorMessage(payload);
  }

  private createIncidentMessage(payload: InstatusIncidentWebhook): CreateMessageDto {
    const { incident, page } = payload;
    
    const title = `🚨 Incident: ${incident.name}`;
    const lines: string[] = [];

    lines.push(`<strong>Status:</strong> ${this.formatStatus(incident.status)}`);
    if (incident.impact) {
      lines.push(`<strong>Impact:</strong> ${this.formatImpact(incident.impact)}`);
    }

    if (incident.incident_updates && incident.incident_updates.length > 0) {
      const latestUpdate = incident.incident_updates[incident.incident_updates.length - 1];
      if (latestUpdate.body) {
        lines.push('');
        lines.push('<strong>Latest Update:</strong>');
        lines.push(latestUpdate.body);
      }
    }

    lines.push('');
    lines.push(`<strong>Started:</strong> ${this.formatDateTime(incident.created_at)}`);
    if (incident.resolved_at) {
      lines.push(`<strong>Resolved:</strong> ${this.formatDateTime(incident.resolved_at)}`);
    }

    lines.push('');
    lines.push(`🔗 <a href="${incident.url}">View Incident</a>`);
    lines.push(`📊 <a href="${page.url}">Status Page</a>`);

    const deliveryType = this.getIncidentDeliveryType(incident.status, incident.resolved_at);

    return {
      title,
      body: lines.join('\n'),
      deliveryType,
      bucketId: '',
    } as CreateMessageDto;
  }

  private createMaintenanceMessage(payload: InstatusMaintenanceWebhook): CreateMessageDto {
    const { maintenance, page } = payload;
    
    const title = `🔧 Maintenance: ${maintenance.name}`;
    const lines: string[] = [];

    lines.push(`<strong>Status:</strong> ${this.formatMaintenanceStatus(maintenance.status)}`);
    if (maintenance.impact) {
      lines.push(`<strong>Impact:</strong> ${this.formatImpact(maintenance.impact)}`);
    }
    if (maintenance.duration) {
      lines.push(`<strong>Duration:</strong> ${maintenance.duration}`);
    }

    if (maintenance.maintenance_updates && maintenance.maintenance_updates.length > 0) {
      const latestUpdate = maintenance.maintenance_updates[maintenance.maintenance_updates.length - 1];
      if (latestUpdate.body) {
        lines.push('');
        lines.push('<strong>Latest Update:</strong>');
        lines.push(latestUpdate.body);
      }
    }

    lines.push('');
    lines.push(`<strong>Created:</strong> ${this.formatDateTime(maintenance.created_at)}`);
    if (maintenance.resolved_at) {
      lines.push(`<strong>Completed:</strong> ${this.formatDateTime(maintenance.resolved_at)}`);
    }

    lines.push('');
    lines.push(`🔗 <a href="${maintenance.url}">View Maintenance</a>`);
    lines.push(`📊 <a href="${page.url}">Status Page</a>`);

    return {
      title,
      body: lines.join('\n'),
      deliveryType: NotificationDeliveryType.NORMAL,
      bucketId: '',
    } as CreateMessageDto;
  }

  private createComponentUpdateMessage(payload: InstatusComponentWebhook): CreateMessageDto {
    const { component, component_update, page } = payload;
    
    const statusIcon = this.getComponentStatusIcon(component_update.new_status);
    const title = `${statusIcon} Component Update: ${component.name}`;
    const lines: string[] = [];

    lines.push(`<strong>New Status:</strong> ${this.formatComponentStatus(component_update.new_status)}`);
    lines.push(`<strong>Component:</strong> ${component.name}`);
    lines.push('');
    lines.push(`📊 <a href="${page.url}">Status Page</a>`);

    const deliveryType = this.getComponentDeliveryType(component_update.new_status);

    return {
      title,
      body: lines.join('\n'),
      deliveryType,
      bucketId: '',
    } as CreateMessageDto;
  }

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'INVESTIGATING': '🔍 Investigating',
      'IDENTIFIED': '⚠️ Identified',
      'MONITORING': '👁️ Monitoring',
      'RESOLVED': '✅ Resolved',
    };
    return statusMap[status] || status;
  }

  private formatMaintenanceStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'NOTSTARTEDYET': '⏰ Not Started Yet',
      'INPROGRESS': '🔄 In Progress',
      'COMPLETED': '✅ Completed',
    };
    return statusMap[status] || status;
  }

  private formatComponentStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'OPERATIONAL': '✅ Operational',
      'UNDERMAINTENANCE': '🔧 Under Maintenance',
      'DEGRADEDPERFORMANCE': '⚠️ Degraded Performance',
      'PARTIALOUTAGE': '🔴 Partial Outage',
      'MAJOROUTAGE': '🚨 Major Outage',
    };
    return statusMap[status] || status;
  }

  private formatImpact(impact: string): string {
    return impact.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  private getComponentStatusIcon(status: string): string {
    const iconMap: Record<string, string> = {
      'OPERATIONAL': '✅',
      'UNDERMAINTENANCE': '🔧',
      'DEGRADEDPERFORMANCE': '⚠️',
      'PARTIALOUTAGE': '🔴',
      'MAJOROUTAGE': '🚨',
    };
    return iconMap[status] || '📢';
  }

  private formatDateTime(dateTimeStr: string): string {
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return dateTimeStr;
    }
  }

  private getIncidentDeliveryType(status: string, resolvedAt: string): NotificationDeliveryType {
    if (resolvedAt) {
      return NotificationDeliveryType.NORMAL;
    }

    const criticalStatuses = ['INVESTIGATING', 'IDENTIFIED'];
    if (criticalStatuses.includes(status)) {
      return NotificationDeliveryType.CRITICAL;
    }

    return NotificationDeliveryType.NORMAL;
  }

  private getComponentDeliveryType(status: string): NotificationDeliveryType {
    const criticalStatuses = ['PARTIALOUTAGE', 'MAJOROUTAGE'];
    if (criticalStatuses.includes(status)) {
      return NotificationDeliveryType.CRITICAL;
    }

    return NotificationDeliveryType.NORMAL;
  }

  private createErrorMessage(payload: any): CreateMessageDto {
    return {
      title: '⚠️ Instatus Webhook Parse Error',
      body: `Failed to parse Instatus webhook payload.\n\nRaw data:\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
      deliveryType: NotificationDeliveryType.NORMAL,
      bucketId: '',
    } as CreateMessageDto;
  }
}

