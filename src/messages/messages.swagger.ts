export const CreateMessageApiBodySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', example: 'Welcome!' },
    subtitle: { type: 'string', example: 'Important update' },
    body: { type: 'string', example: 'Your subscription has been updated.' },
    attachments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mediaType: {
            type: 'string',
            enum: ['VIDEO', 'IMAGE', 'GIF', 'AUDIO', 'ICON'],
            example: 'IMAGE',
          },
          url: { type: 'string', example: 'https://example.com/image.jpg' },
          saveOnServer: { type: 'boolean', example: true },
          name: { type: 'string', example: 'cover.jpg' },
        },
        required: ['mediaType'],
      },
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'NAVIGATE',
              'BACKGROUND_CALL',
              'MARK_AS_READ',
              'SNOOZE',
              'OPEN_NOTIFICATION',
              'WEBHOOK',
              'DELETE',
            ],
            example: 'NAVIGATE',
          },
          value: { type: 'string', example: '/(mobile)' },
          destructive: { type: 'boolean', example: false },
          icon: { type: 'string', example: 'arrow-right' },
          title: { type: 'string', example: 'Open' },
        },
        required: ['type', 'value', 'destructive', 'icon', 'title'],
      },
    },
    tapAction: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'NAVIGATE',
            'BACKGROUND_CALL',
            'MARK_AS_READ',
            'SNOOZE',
            'OPEN_NOTIFICATION',
            'WEBHOOK',
            'DELETE',
          ],
          example: 'NAVIGATE',
        },
        value: { type: 'string', example: '/(mobile)' },
        destructive: { type: 'boolean', example: false },
        icon: { type: 'string', example: 'arrow-right' },
        title: { type: 'string', example: 'Open App' },
      },
    },
    sound: { type: 'string', example: 'default' },
    deliveryType: {
      type: 'string',
      enum: ['SILENT', 'NORMAL', 'CRITICAL'],
      example: 'NORMAL',
    },
    addMarkAsReadAction: { type: 'boolean', example: true },
    addOpenNotificationAction: { type: 'boolean', example: true },
    addDeleteAction: { type: 'boolean', example: false },
    snoozes: { type: 'array', items: { type: 'number' }, example: [5, 15, 30] },
    locale: { type: 'string', example: 'en-EN' },
    bucketId: { type: 'string', example: 'bucket-uuid' },
  },
  required: ['title', 'deliveryType', 'bucketId'],
} as const;

export const CreateMessageWithAttachmentApiBodySchema = {
  ...CreateMessageApiBodySchema,
  properties: {
    ...(CreateMessageApiBodySchema as any).properties,
    file: { type: 'string', format: 'binary' },
    attachmentOptions: {
      type: 'object',
      properties: {
        mediaType: {
          type: 'string',
          enum: ['VIDEO', 'IMAGE', 'GIF', 'AUDIO', 'ICON'],
          example: 'IMAGE',
        },
        name: { type: 'string', example: 'cover.jpg' },
      },
      required: ['mediaType'],
    },
  },
  required: [
    ...((CreateMessageApiBodySchema as any).required || []),
    'file',
    'attachmentOptions',
  ],
} as const;
