import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CreateMessageDto } from '../dto/create-message.dto';

export const CombineMessageSources = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CreateMessageDto => {
    const request = ctx.switchToHttp().getRequest();
    const { body, query, params, headers } = request;

    // Start with body data as base
    const messageData: any = { ...body };

    // Override with query parameters (query takes precedence over body)
    if (query) {
      Object.keys(query).forEach((key) => {
        if (query[key] !== undefined && query[key] !== null) {
          messageData[key] = query[key];
        }
      });
    }

    // Override with path parameters (params take precedence over query and body)
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null) {
          messageData[key] = params[key];
        }
      });
    }

    // Override with header values (headers take highest precedence)
    // Only process headers that start with 'x-message-'
    if (headers) {
      Object.keys(headers).forEach((key) => {
        if (
          key.startsWith('x-message-') &&
          headers[key] !== undefined &&
          headers[key] !== null
        ) {
          // Remove 'x-message-' prefix and convert to camelCase
          const cleanKey = key.replace('x-message-', '');
          messageData[cleanKey] = headers[key];
        }
      });
    }

    // Handle special transformations for specific fields
    if (messageData.snoozes && typeof messageData.snoozes === 'string') {
      messageData.snoozes = messageData.snoozes
        .split(',')
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => !isNaN(v));
    }

    if (
      messageData.attachments &&
      typeof messageData.attachments === 'string'
    ) {
      try {
        messageData.attachments = JSON.parse(messageData.attachments);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    if (messageData.actions && typeof messageData.actions === 'string') {
      try {
        messageData.actions = JSON.parse(messageData.actions);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    if (messageData.tapAction && typeof messageData.tapAction === 'string') {
      try {
        messageData.tapAction = JSON.parse(messageData.tapAction);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    // Handle boolean transformations
    const booleanFields = [
      'addMarkAsReadAction',
      'addOpenNotificationAction',
      'addDeleteAction',
      'saveOnServer',
      'destructive',
    ];

    booleanFields.forEach((field) => {
      if (messageData[field] !== undefined && messageData[field] !== null) {
        if (typeof messageData[field] === 'string') {
          messageData[field] = messageData[field].toLowerCase() === 'true';
        }
      }
    });

    return messageData as CreateMessageDto;
  },
);
