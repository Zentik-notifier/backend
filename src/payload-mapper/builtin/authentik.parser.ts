import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser, ParserOptions } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

@Injectable()
export class AuthentikParser implements IBuiltinParser {
  readonly name = 'Authentik';
  readonly builtInType = PayloadMapperBuiltInType.ZENTIK_AUTHENTIK;
  readonly description =
    'Parser for Authentik notifications - handles login, logout, registration, update available and other events';

  async parse(payload: any, options?: ParserOptions): Promise<CreateMessageDto> {
    return new Promise(resolve => resolve(this.syncParse(payload, options)));
  }

  private syncParse(payload: any, options?: ParserOptions): CreateMessageDto {
    const eventType = this.extractEventTypeFromBody(payload.body);
    const extractedData = this.extractDataFromBody(payload.body);

    // Use event_user_* fields if available, fallback to user_* fields
    const username = payload.event_user_username ?? payload.user_username;
    const email = payload.event_user_email ?? payload.user_email;

    return {
      title: this.getNotificationTitle(eventType, {
        username: username,
        email: email,
      }),
      subtitle: this.getNotificationSubtitle(eventType, {
        username: username,
        email: email,
      }),
      body: this.getNotificationBody(
        eventType,
        {
          username: username,
          email: email,
        },
        extractedData,
        payload.body,
      ),
      deliveryType: this.getEventPriority(eventType),
      bucketId: '', // Will be set by the service
    };
  }

  async validate(payload: any, options?: ParserOptions): Promise<boolean> {
    return new Promise(resolve => resolve(this.syncValidate(payload, options)));
  }

  private syncValidate(payload: any, options?: ParserOptions): boolean {
    // Headers are available if needed for future webhook signature verification
    // For now, Authentik doesn't require signature verification in this parser
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    if (!payload.body || !payload.severity) {
      return false;
    }

    if (!(payload.user_email || payload.event_user_email)) {
      return false;
    }

    if (!(payload.user_username || payload.event_user_username)) {
      return false;
    }

    return true;
  }

  private getNotificationTitle(eventType: string, user: any): string {
    const eventName =
      eventType === 'loginSuccess'
        ? 'login'
        : eventType === 'loginFailed'
          ? 'login_failed'
          : eventType;

    // For unmapped events, just return the event name
    if (
      eventType === 'unknown' ||
      !['loginSuccess', 'loginFailed', 'logout', 'updateAvailable'].includes(
        eventType,
      )
    ) {
      return `${eventName.charAt(0).toUpperCase()}${eventName.slice(1)} - Unmapped event`;
    }

    if (eventType === 'updateAvailable') {
      return 'Update Available';
    }

    return `${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}: ${user.username}`;
  }

  private getNotificationSubtitle(eventType: string, user: any): string {
    // For unmapped events, don't show subtitle
    if (
      eventType === 'unknown' ||
      !['loginSuccess', 'loginFailed', 'logout', 'updateAvailable'].includes(
        eventType,
      )
    ) {
      return '';
    }

    if (eventType === 'updateAvailable') {
      return user.email;
    }

    return user.email;
  }

  private getNotificationBody(
    eventType: string,
    user: any,
    context: any,
    originalBody?: string,
  ): string {
    // For unmapped events, return the original body directly
    if (
      eventType === 'unknown' ||
      !['loginSuccess', 'loginFailed', 'logout', 'updateAvailable'].includes(
        eventType,
      )
    ) {
      return originalBody || 'No body content available';
    }

    // For updateAvailable events, return the original body directly
    if (eventType === 'updateAvailable') {
      return originalBody || 'No body content available';
    }

    const nextRoute = context.pathNext;
    const userAgent = context.userAgent;
    const authMethod = context.authMethod;
    const geo = context.geo;
    const asn = context.asn;

    // Extract target app from nextRoute if available
    let target;
    if (nextRoute && nextRoute !== '/') {
      try {
        const routeToParse = `http://localhost:9090${nextRoute}`;
        const url = new URL(routeToParse);
        const redirectUri = url.searchParams.get('redirect_uri');
        if (redirectUri) {
          const redirectUrl = new URL(redirectUri);
          target = redirectUrl.origin;
        }
      } catch (error) {
        // Ignore URL parsing errors
      }
    }

    let message = user.username;

    if (target) {
      message += `\nApp: ${target}`;
    }
    if (userAgent) {
      message += `\nUser agent: ${userAgent}`;
    }
    if (authMethod) {
      message += `\nAuthentication method: ${authMethod}`;
    }
    if (asn) {
      message += `\nASN: ${asn.asn} (${asn.as_org})`;
    }
    if (geo) {
      message += `\nLocation: ${geo.city}, ${geo.country}`;
    }

    return message;
  }

  private extractEventTypeFromBody(body: string): string {
    // Check for specific patterns in the body
    if (body.includes('logged in successfully')) {
      return 'loginSuccess';
    }
    if (body.includes('failed to log in')) {
      return 'loginFailed';
    }
    if (body.includes('logged out')) {
      return 'logout';
    }
    if (body.includes('New version') && body.includes('available')) {
      return 'updateAvailable';
    }

    // Fallback to pattern matching for other formats
    const match = body.match(/^(\w+):/);
    if (match) {
      const eventType = match[1];
      // Map to standard event types
      switch (eventType) {
        case 'login':
          return 'loginSuccess';
        case 'login_failed':
          return 'loginFailed';
        case 'logout':
          return 'logout';
        default:
          return eventType;
      }
    }
    return 'unknown';
  }

  private extractDataFromBody(body: string): any {
    try {
      // Extract the JSON part after the colon
      const jsonMatch = body.match(/:\s*({.*})$/);
      if (!jsonMatch) {
        return {};
      }

      let jsonStr = jsonMatch[1];

      // Convert Python-style dictionary to valid JSON
      // Replace single quotes with double quotes
      jsonStr = jsonStr.replace(/'/g, '"');

      // Convert Python boolean values to JSON boolean values
      jsonStr = jsonStr.replace(/\bTrue\b/g, 'true');
      jsonStr = jsonStr.replace(/\bFalse\b/g, 'false');
      jsonStr = jsonStr.replace(/\bNone\b/g, 'null');

      const data = JSON.parse(jsonStr);

      return {
        userAgent: data.userAgent || data.http_request?.user_agent,
        asn: data.asn,
        geo: data.geo,
        pathNext: data.pathNext || data.http_request?.args?.next,
        authMethod: data.authMethod || data.auth_method,
        authMethodArgs: data.authMethodArgs || data.auth_method_args,
        stage: data.stage,
        password: data.password,
        username: data.username,
      };
    } catch (error) {
      console.warn('Failed to parse Authentik body JSON:', error);
      return {};
    }
  }

  private getEventPriority(eventType: string): NotificationDeliveryType {
    const highPriorityEvents = ['loginFailed'];
    const lowPriorityEvents = ['logout'];
    const normalPriorityEvents = ['updateAvailable'];

    if (highPriorityEvents.includes(eventType)) {
      return NotificationDeliveryType.CRITICAL;
    }
    if (lowPriorityEvents.includes(eventType)) {
      return NotificationDeliveryType.NORMAL;
    }
    if (normalPriorityEvents.includes(eventType)) {
      return NotificationDeliveryType.NORMAL;
    }
    // For unmapped events, use normal priority
    return NotificationDeliveryType.NORMAL;
  }
}
