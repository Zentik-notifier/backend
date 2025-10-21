import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser, ParserOptions } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

export interface StatuspageMetadata {
  unsubscribe: string;
  documentation: string;
}

export interface StatuspagePage {
  id: string;
  status_indicator: string;
  status_description: string;
}

export interface StatuspageIncidentUpdate {
  id: string;
  incident_id: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
  display_at: string;
  wants_twitter_update: boolean;
  twitter_updated_at: string | null;
}

export interface StatuspageIncident {
  backfilled: boolean;
  created_at: string;
  impact: string;
  impact_override: string | null;
  monitoring_at: string | null;
  name: string;
  resolved_at: string | null;
  status: string;
  updated_at: string;
  id: string;
  organization_id: string;
  shortlink: string;
  scheduled_for: string | null;
  scheduled_until: string | null;
  scheduled_auto_transition: boolean;
  scheduled_remind_prior: boolean;
  scheduled_reminded_at: string | null;
  postmortem_body: string | null;
  postmortem_body_last_updated_at: string | null;
  postmortem_ignored: boolean;
  postmortem_notified_subscribers: boolean;
  postmortem_notified_twitter: boolean;
  postmortem_published_at: string | null;
  incident_updates: StatuspageIncidentUpdate[];
}

export interface StatuspageComponent {
  created_at: string;
  id: string;
  name: string;
  status: string;
}

export interface StatuspageComponentUpdate {
  created_at: string;
  new_status: string;
  old_status: string;
  id: string;
  component_id: string;
}

export interface StatuspageIncidentWebhook {
  meta: StatuspageMetadata;
  page: StatuspagePage;
  incident: StatuspageIncident;
}

export interface StatuspageComponentWebhook {
  meta: StatuspageMetadata;
  page: StatuspagePage;
  component_update: StatuspageComponentUpdate;
  component: StatuspageComponent;
}

export type StatuspageWebhookPayload = StatuspageIncidentWebhook | StatuspageComponentWebhook;

@Injectable()
export class AtlasStatuspageParser implements IBuiltinParser {
  get builtInType(): PayloadMapperBuiltInType {
    return PayloadMapperBuiltInType.ZENTIK_ATLAS_STATUSPAGE;
  }

  get name(): string {
    return 'Atlassian Statuspage';
  }

  get description(): string {
    return 'Parser for Atlassian Statuspage webhooks - handles incidents and component updates';
  }

  async validate(payload: any, options?: ParserOptions): Promise<boolean> {
    return new Promise(resolve => resolve(this.syncValidate(payload, options)));
  }

  private syncValidate(payload: any, options?: ParserOptions): boolean {
    return !!(
      payload &&
      typeof payload === 'object' &&
      payload.meta &&
      payload.page?.id &&
      (payload.incident || payload.component_update)
    );
  }

  async parse(payload: StatuspageWebhookPayload, options?: ParserOptions): Promise<CreateMessageDto> {
    return new Promise(resolve => resolve(this.syncParse(payload, options)));
  }

  private syncParse(payload: StatuspageWebhookPayload, options?: ParserOptions): CreateMessageDto {
    try {
      return this.createMessage(payload);
    } catch (error) {
      console.error('Error parsing Statuspage payload:', error);
      return this.createErrorMessage(payload);
    }
  }

  private createMessage(payload: StatuspageWebhookPayload): CreateMessageDto {
    const hasIncident = 'incident' in payload;
    const hasComponentUpdate = 'component_update' in payload;

    if (hasIncident) {
      return this.createIncidentMessage(payload as StatuspageIncidentWebhook);
    } else if (hasComponentUpdate) {
      return this.createComponentUpdateMessage(payload as StatuspageComponentWebhook);
    }

    return this.createErrorMessage(payload);
  }

  private createIncidentMessage(payload: StatuspageIncidentWebhook): CreateMessageDto {
    const { incident, page } = payload;
    
    const title = `🚨 Incident: ${incident.name}`;
    const lines: string[] = [];

    lines.push(`<strong>Status:</strong> ${this.formatStatus(incident.status)}`);
    if (incident.impact) {
      lines.push(`<strong>Impact:</strong> ${this.formatImpact(incident.impact)}`);
    }

    if (incident.incident_updates && incident.incident_updates.length > 0) {
      const latestUpdate = incident.incident_updates[0];
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
    if (incident.shortlink) {
      lines.push(`🔗 <a href="${incident.shortlink}">View Incident</a>`);
    }
    lines.push(`📊 <a href="https://statuspage.io">Status Page</a>`);

    const deliveryType = this.getIncidentDeliveryType(incident.status, incident.resolved_at);

    return {
      title,
      body: lines.join('\n'),
      deliveryType,
      bucketId: '',
    } as CreateMessageDto;
  }

  private createComponentUpdateMessage(payload: StatuspageComponentWebhook): CreateMessageDto {
    const { component, component_update, page } = payload;
    
    const statusIcon = this.getComponentStatusIcon(component_update.new_status);
    const title = `${statusIcon} Component Update: ${component.name}`;
    const lines: string[] = [];

    lines.push(`<strong>Status Change:</strong> ${this.formatComponentStatus(component_update.old_status)} → ${this.formatComponentStatus(component_update.new_status)}`);
    lines.push(`<strong>Component:</strong> ${component.name}`);
    lines.push('');
    lines.push(`<strong>Page Status:</strong> ${page.status_description}`);
    lines.push('');
    lines.push(`📊 <a href="https://statuspage.io">Status Page</a>`);

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
      'investigating': '🔍 Investigating',
      'identified': '⚠️ Identified',
      'monitoring': '👁️ Monitoring',
      'resolved': '✅ Resolved',
      'postmortem': '📝 Postmortem',
    };
    return statusMap[status.toLowerCase()] || status;
  }

  private formatComponentStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'operational': '✅ Operational',
      'under_maintenance': '🔧 Under Maintenance',
      'degraded_performance': '⚠️ Degraded Performance',
      'partial_outage': '🔴 Partial Outage',
      'major_outage': '🚨 Major Outage',
    };
    return statusMap[status.toLowerCase()] || status;
  }

  private formatImpact(impact: string): string {
    const impactMap: Record<string, string> = {
      'none': 'None',
      'minor': '⚠️ Minor',
      'major': '🔴 Major',
      'critical': '🚨 Critical',
    };
    return impactMap[impact.toLowerCase()] || impact;
  }

  private getComponentStatusIcon(status: string): string {
    const iconMap: Record<string, string> = {
      'operational': '✅',
      'under_maintenance': '🔧',
      'degraded_performance': '⚠️',
      'partial_outage': '🔴',
      'major_outage': '🚨',
    };
    return iconMap[status.toLowerCase()] || '📢';
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

  private getIncidentDeliveryType(status: string, resolvedAt: string | null): NotificationDeliveryType {
    if (resolvedAt) {
      return NotificationDeliveryType.NORMAL;
    }

    const criticalStatuses = ['investigating', 'identified'];
    if (criticalStatuses.includes(status.toLowerCase())) {
      return NotificationDeliveryType.CRITICAL;
    }

    return NotificationDeliveryType.NORMAL;
  }

  private getComponentDeliveryType(status: string): NotificationDeliveryType {
    const criticalStatuses = ['partial_outage', 'major_outage'];
    if (criticalStatuses.includes(status.toLowerCase())) {
      return NotificationDeliveryType.CRITICAL;
    }

    return NotificationDeliveryType.NORMAL;
  }

  private createErrorMessage(payload: any): CreateMessageDto {
    return {
      title: '⚠️ Statuspage Webhook Parse Error',
      body: `Failed to parse Atlassian Statuspage webhook payload.\n\nRaw data:\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
      deliveryType: NotificationDeliveryType.NORMAL,
      bucketId: '',
    } as CreateMessageDto;
  }
}

