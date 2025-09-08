import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

@Injectable()
export class AuthentikParser implements IBuiltinParser {
  readonly name = 'Authentik';
  readonly builtInType = PayloadMapperBuiltInType.ZentikAuthentik;
  readonly description = 'Parser for Authentik notifications - handles login, logout, registration and other events';

  parse(payload: any): CreateMessageDto {
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
      body: this.getNotificationBody(eventType, {
        username: username,
        email: email,
      }, extractedData, payload.body),
      deliveryType: this.getEventPriority(eventType),
      bucketId: '', // Will be set by the service
    };
  }

  validate(payload: any): boolean {
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
    const eventName = eventType === 'loginSuccess' ? 'login' : 
                     eventType === 'loginFailed' ? 'login_failed' : 
                     eventType;
    
    // For unmapped events, just return the event name
    if (eventType === 'unknown' || !['loginSuccess', 'loginFailed', 'logout'].includes(eventType)) {
      return `${eventName.charAt(0).toUpperCase()}${eventName.slice(1)} - Unmapped event`;
    }
    
    return `${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}: ${user.username}`;
  }

  private getNotificationSubtitle(eventType: string, user: any): string {
    // For unmapped events, don't show subtitle
    if (eventType === 'unknown' || !['loginSuccess', 'loginFailed', 'logout'].includes(eventType)) {
      return '';
    }
    
    return user.email;
  }

  private getNotificationBody(eventType: string, user: any, context: any, originalBody?: string): string {
    // For unmapped events, return the original body directly
    if (eventType === 'unknown' || !['loginSuccess', 'loginFailed', 'logout'].includes(eventType)) {
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

  private extractDeviceFromUserAgent(userAgent: string): string {
    if (!userAgent) return 'unknown device';
    
    // Extract browser
    let browser = 'unknown browser';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    
    // Extract OS
    let os = 'unknown OS';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac OS X')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    
    return `${browser} on ${os}`;
  }

  private getEventIcon(eventType: string): string {
    const eventIcons = {
      'loginSuccess': '✅',
      'loginFailed': '❌',
      'logout': '🚪',
    };

    return eventIcons[eventType] || '❓'; // Question mark for unmapped events
  }

  private getEventColor(eventType: string): string {
    const eventColors = {
      'loginSuccess': '#4CAF50',   // Green for successful login
      'loginFailed': '#F44336',     // Red for failed login
      'logout': '#FF9800',          // Orange for logout
    };

    return eventColors[eventType] || '#9C27B0'; // Purple for unmapped events
  }

  private getEventPriority(eventType: string): NotificationDeliveryType {
    const highPriorityEvents = ['loginFailed'];
    const lowPriorityEvents = ['logout'];

    if (highPriorityEvents.includes(eventType)) {
      return NotificationDeliveryType.CRITICAL;
    }
    if (lowPriorityEvents.includes(eventType)) {
      return NotificationDeliveryType.NORMAL;
    }
    // For unmapped events, use normal priority
    return NotificationDeliveryType.NORMAL;
  }
}
