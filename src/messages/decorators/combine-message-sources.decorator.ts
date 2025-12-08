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

    // Collect template-* parameters from headers and query params
    const templateDataParams: Record<string, any> = {};
    
    // Helper function to parse JSON strings
    const parseIfJson = (value: any): any => {
      if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    };
    
    // Collect from query params
    if (query) {
      Object.keys(query).forEach((key) => {
        if (
          key.startsWith('template-') &&
          query[key] !== undefined &&
          query[key] !== null
        ) {
          const cleanKey = key.replace('template-', '');
          templateDataParams[cleanKey] = parseIfJson(query[key]);
        }
      });
    }

    // Collect from headers (headers take precedence over query)
    if (headers) {
      Object.keys(headers).forEach((key) => {
        if (
          key.startsWith('template-') &&
          headers[key] !== undefined &&
          headers[key] !== null
        ) {
          const cleanKey = key.replace('template-', '');
          templateDataParams[cleanKey] = parseIfJson(headers[key]);
        }
      });
    }

    // Handle templateData if it's a string (JSON)
    if (messageData.templateData && typeof messageData.templateData === 'string') {
      try {
        messageData.templateData = JSON.parse(messageData.templateData);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    // Merge template-* parameters into templateData
    if (Object.keys(templateDataParams).length > 0) {
      if (!messageData.templateData) {
        messageData.templateData = {};
      }
      // Merge templateDataParams into existing templateData
      messageData.templateData = {
        ...messageData.templateData,
        ...templateDataParams,
      };
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
