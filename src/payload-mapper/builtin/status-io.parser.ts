import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser, ParserOptions } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

export interface StatusIoComponentContainer {
  component: string;
  container: string;
}

export interface StatusIoComponent {
  name: string;
  _id: string;
}

export interface StatusIoContainer {
  name: string;
  _id: string;
}

export interface StatusIoMaintenancePayload {
  id: string;
  message_id: string;
  title: string;
  datetime: string;
  datetime_start: string;
  datetime_end: string;
  current_status: string;
  infrastructure_affected: StatusIoComponentContainer[];
  components: StatusIoComponent[];
  containers: StatusIoContainer[];
  details: string;
  maintenance_url: string;
  status_page_url: string;
}

export interface StatusIoIncidentPayload {
  id: string;
  message_id: string;
  title: string;
  datetime: string;
  datetime_start: string;
  datetime_resolve: string;
  current_status: string;
  current_state: string;
  previous_status: string;
  previous_state: string;
  infrastructure_affected: StatusIoComponentContainer[];
  components: StatusIoComponent[];
  containers: StatusIoContainer[];
  details: string;
  incident_url: string;
  status_page_url: string;
}

export type StatusIoWebhookPayload = StatusIoMaintenancePayload | StatusIoIncidentPayload;

@Injectable()
export class StatusIoParser implements IBuiltinParser {
  get builtInType(): PayloadMapperBuiltInType {
    return PayloadMapperBuiltInType.ZENTIK_STATUS_IO;
  }

  get name(): string {
    return 'Status.io';
  }

  get description(): string {
    return 'Parser for Status.io webhooks - handles incidents and scheduled maintenance events';
  }

  async validate(payload: any, options?: ParserOptions): Promise<boolean> {
    return new Promise(resolve => resolve(this.syncValidate(payload, options)));
  }

  private syncValidate(payload: any, options?: ParserOptions): boolean {
    return !!(
      payload &&
      typeof payload === 'object' &&
      payload.id &&
      payload.message_id &&
      payload.title &&
      payload.details &&
      payload.status_page_url &&
      (payload.maintenance_url || payload.incident_url)
    );
  }

  async parse(payload: StatusIoWebhookPayload, options?: ParserOptions): Promise<CreateMessageDto> {
    return new Promise(resolve => resolve(this.syncParse(payload, options)));
  }

  private syncParse(payload: StatusIoWebhookPayload, options?: ParserOptions): CreateMessageDto {
    try {
      return this.createMessage(payload);
    } catch (error) {
      console.error('Error parsing Status.io payload:', error);
      return this.createErrorMessage(payload);
    }
  }

  private createMessage(payload: StatusIoWebhookPayload): CreateMessageDto {
    const isIncident = 'incident_url' in payload;
    const isMaintenance = 'maintenance_url' in payload;

    const title = this.formatTitle(payload, isIncident, isMaintenance);
    const body = this.formatBody(payload, isIncident, isMaintenance);
    const deliveryType = this.getDeliveryType(payload, isIncident);

    return {
      title,
      body,
      deliveryType,
      bucketId: '', // Will be set by the service
    } as CreateMessageDto;
  }

  private formatTitle(payload: StatusIoWebhookPayload, isIncident: boolean, isMaintenance: boolean): string {
    const prefix = isIncident ? '🚨' : isMaintenance ? '🔧' : '📢';
    const type = isIncident ? 'Incident' : isMaintenance ? 'Maintenance' : 'Status Update';
    
    return `${prefix} ${type}: ${payload.title}`;
  }

  private formatBody(payload: StatusIoWebhookPayload, isIncident: boolean, isMaintenance: boolean): string {
    const lines: string[] = [];

    // Status/State information
    if (isIncident) {
      const incident = payload as StatusIoIncidentPayload;
      if (incident.current_status) {
        lines.push(`Status: ${incident.current_status}`);
      }
      if (incident.current_state) {
        lines.push(`State: ${incident.current_state}`);
      }
      if (incident.previous_status && incident.previous_state) {
        lines.push(`Previous: ${incident.previous_status} (${incident.previous_state})`);
      }
    } else if (isMaintenance) {
      const maintenance = payload as StatusIoMaintenancePayload;
      if (maintenance.current_status) {
        lines.push(`Status: ${maintenance.current_status}`);
      }
    }

    // Details
    if (payload.details) {
      lines.push('');
      lines.push(payload.details);
    }

    // Time information
    if (isIncident) {
      const incident = payload as StatusIoIncidentPayload;
      if (incident.datetime_start) {
        lines.push('');
        lines.push(`Started: ${this.formatDateTime(incident.datetime_start)}`);
      }
      if (incident.datetime_resolve) {
        lines.push(`Resolved: ${this.formatDateTime(incident.datetime_resolve)}`);
      }
    } else if (isMaintenance) {
      const maintenance = payload as StatusIoMaintenancePayload;
      if (maintenance.datetime_start && maintenance.datetime_end) {
        lines.push('');
        lines.push(`Window: ${this.formatDateTime(maintenance.datetime_start)} - ${this.formatDateTime(maintenance.datetime_end)}`);
      }
    }

    // Affected infrastructure
    if (payload.components && payload.components.length > 0) {
      lines.push('');
      lines.push(`Affected Components: ${payload.components.map(c => c.name).join(', ')}`);
    }

    if (payload.containers && payload.containers.length > 0) {
      lines.push(`Affected Locations: ${payload.containers.map(c => c.name).join(', ')}`);
    }

    // Links
    lines.push('');
    if (isIncident) {
      const incident = payload as StatusIoIncidentPayload;
      lines.push(`🔗 View Incident: ${incident.incident_url}`);
    } else if (isMaintenance) {
      const maintenance = payload as StatusIoMaintenancePayload;
      lines.push(`🔗 View Maintenance: ${maintenance.maintenance_url}`);
    }
    lines.push(`📊 Status Page: ${payload.status_page_url}`);

    return lines.join('\n');
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

  private getDeliveryType(payload: StatusIoWebhookPayload, isIncident: boolean): NotificationDeliveryType {
    if (isIncident) {
      const incident = payload as StatusIoIncidentPayload;
      // Critical status for incidents
      const criticalStates = ['investigating', 'identified'];
      const criticalStatuses = ['major outage', 'partial outage', 'service disruption'];
      
      if (incident.current_state && criticalStates.includes(incident.current_state.toLowerCase())) {
        return NotificationDeliveryType.CRITICAL;
      }
      if (incident.current_status && criticalStatuses.some(s => incident.current_status.toLowerCase().includes(s))) {
        return NotificationDeliveryType.CRITICAL;
      }
      if (incident.datetime_resolve) {
        return NotificationDeliveryType.NORMAL; // Resolved incident
      }
      return NotificationDeliveryType.CRITICAL; // Default for incidents
    }
    
    // Normal priority for maintenance
    return NotificationDeliveryType.NORMAL;
  }

  private createErrorMessage(payload: any): CreateMessageDto {
    return {
      title: '⚠️ Status.io Webhook Parse Error',
      body: `Failed to parse Status.io webhook payload.\n\nRaw data:\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
      deliveryType: NotificationDeliveryType.NORMAL,
      bucketId: '', // Will be set by the service
    } as CreateMessageDto;
  }
}

