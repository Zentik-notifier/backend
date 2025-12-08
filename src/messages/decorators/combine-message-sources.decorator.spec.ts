describe('CombineMessageSources Decorator Logic', () => {
  // Helper to create default test data
  const createTestData = (overrides: {
    body?: any;
    query?: any;
    params?: any;
    headers?: any;
  } = {}) => ({
    body: { title: 'Body Title', bucketId: 'bucket-1', deliveryType: 'NORMAL', ...overrides.body },
    query: { ...overrides.query },
    params: { ...overrides.params },
    headers: { ...overrides.headers },
  });

  // Testa la logica interna del decoratore direttamente (replica la logica per testarla)
  const combineMessageSources = (
    body: any = {},
    query: any = {},
    params: any = {},
    headers: any = {},
  ) => {
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

    return messageData;
  };

  describe('Data source precedence', () => {
    it('should prioritize headers over query params, query over body', () => {
      const { body, query, params, headers } = createTestData({
        body: { subtitle: 'Body Subtitle' },
        query: { subtitle: 'Query Subtitle', sound: 'query-sound.wav' },
        headers: {
          'x-message-subtitle': 'Header Subtitle',
          'x-message-sound': 'header-sound.wav',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.subtitle).toBe('Header Subtitle');
      expect(result.sound).toBe('header-sound.wav');
    });

    it('should prioritize query params over body', () => {
      const { body, query, params, headers } = createTestData({
        body: { subtitle: 'Body Subtitle' },
        query: { subtitle: 'Query Subtitle', sound: 'query-sound.wav' },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.subtitle).toBe('Query Subtitle');
      expect(result.sound).toBe('query-sound.wav');
    });

    it('should use body as base when no other sources provided', () => {
      const { body, query, params, headers } = createTestData({
        body: { subtitle: 'Body Subtitle' },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.subtitle).toBe('Body Subtitle');
    });
  });

  describe('Header processing', () => {
    it('should only process headers starting with x-message-', () => {
      const { body, query, params, headers } = createTestData({
        headers: {
          'x-message-subtitle': 'Header Subtitle',
          'x-message-sound': 'header-sound.wav',
          authorization: 'Bearer token',
          'content-type': 'application/json',
          'x-other-header': 'Other Value',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.subtitle).toBe('Header Subtitle');
      expect(result.sound).toBe('header-sound.wav');
      expect(result.authorization).toBeUndefined();
      expect(result['content-type']).toBeUndefined();
      expect(result['x-other-header']).toBeUndefined();
    });

    it('should remove x-message- prefix from header keys', () => {
      const { body, query, params, headers } = createTestData({
        headers: {
          'x-message-subtitle': 'Header Subtitle',
          'x-message-addMarkAsReadAction': 'true',
          'x-message-locale': 'en-US',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.subtitle).toBe('Header Subtitle');
      expect(result.addMarkAsReadAction).toBe(true);
      expect(result.locale).toBe('en-US');
    });

    it('should handle undefined and null header values', () => {
      const { body, query, params, headers } = createTestData({
        headers: {
          'x-message-subtitle': undefined,
          'x-message-sound': null,
          'x-message-locale': '',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.subtitle).toBeUndefined();
      expect(result.sound).toBeUndefined();
      expect(result.locale).toBe('');
    });
  });

  describe('Array transformations', () => {
    it.each([
      ['15,30,60,120', [15, 30, 60, 120]],
      ['', ''],
      ['15,invalid,30,60', [15, 30, 60]],
    ])('should handle snoozes string: %s', (input, expected) => {
      const { body, query, params, headers } = createTestData({
        query: { snoozes: input },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.snoozes).toEqual(expected);
    });

    it('should transform attachments JSON string to array', () => {
      const attachments = [
        { mediaType: 'IMAGE', name: 'test.jpg' },
        { mediaType: 'VIDEO', name: 'test.mp4' },
      ];
      const { body, query, params, headers } = createTestData({
        query: { attachments: JSON.stringify(attachments) },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.attachments).toEqual(attachments);
    });

    it('should handle invalid JSON attachments string', () => {
      const { body, query, params, headers } = createTestData({
        query: { attachments: 'invalid json string' },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.attachments).toBe('invalid json string');
    });

    it('should transform actions JSON string to array', () => {
      const actions = [
        {
          type: 'NAVIGATE',
          value: 'https://example.com',
          destructive: 'false',
          icon: 'link',
          title: 'Open Link',
        },
      ];
      const { body, query, params, headers } = createTestData({
        query: { actions: JSON.stringify(actions) },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.actions).toEqual(actions);
    });

    it('should transform tapAction JSON string to object', () => {
      const tapAction = {
        type: 'OPEN_NOTIFICATION',
        value: 'notification-detail',
        destructive: 'false',
        icon: 'eye',
        title: 'View Details',
      };
      const { body, query, params, headers } = createTestData({
        query: { tapAction: JSON.stringify(tapAction) },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.tapAction).toEqual(tapAction);
    });
  });

  describe('Boolean transformations', () => {
    it('should transform boolean fields from strings to booleans', () => {
      const { body, query, params, headers } = createTestData({
        query: {
          addMarkAsReadAction: 'true',
          addOpenNotificationAction: 'false',
          addDeleteAction: 'true',
        },
        headers: {
          'x-message-saveOnServer': 'false',
          'x-message-destructive': 'true',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.addMarkAsReadAction).toBe(true);
      expect(result.addOpenNotificationAction).toBe(false);
      expect(result.addDeleteAction).toBe(true);
      expect(result.saveOnServer).toBe(false);
      expect(result.destructive).toBe(true);
    });

    it.each([
      ['TRUE', true],
      ['False', false],
      ['True', true],
      ['', false],
      [true, true],
      [false, false],
    ])('should handle boolean value: %s', (input, expected) => {
      const { body, query, params, headers } = createTestData({
        query: { addMarkAsReadAction: input },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.addMarkAsReadAction).toBe(expected);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined request properties', () => {
      const result = combineMessageSources();

      expect(result).toEqual({});
    });

    it('should handle null values in all sources', () => {
      const { body, query, params, headers } = createTestData({
        body: { subtitle: null },
        query: { sound: null, locale: null },
        headers: { 'x-message-addMarkAsReadAction': null },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.subtitle).toBeNull();
      expect(result.sound).toBeUndefined();
      expect(result.locale).toBeUndefined();
      expect(result.addMarkAsReadAction).toBeUndefined();
    });

    it('should handle empty objects and arrays', () => {
      const { body, query, params, headers } = createTestData({
        body: { attachments: [] },
        query: { actions: '[]', snoozes: '' },
        headers: { 'x-message-tapAction': '{}' },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.attachments).toEqual([]);
      expect(result.actions).toEqual([]);
      expect(result.snoozes).toBe('');
      expect(result.tapAction).toEqual({});
    });

    it('should preserve original data types when no transformation needed', () => {
      const { body, query, params, headers } = createTestData({
        body: { count: 42, isActive: true },
        query: { tags: ['tag1', 'tag2'], metadata: { key: 'value' } },
        headers: { 'x-message-priority': 'high' },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.count).toBe(42);
      expect(result.isActive).toBe(true);
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.metadata).toEqual({ key: 'value' });
      expect(result.priority).toBe('high');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle mixed data types from all sources', () => {
      const attachments = [{ mediaType: 'IMAGE', name: 'query-image.jpg' }];
      const actions = [
        {
          type: 'NAVIGATE',
          value: 'https://example.com',
          destructive: 'false',
          icon: 'link',
          title: 'Open Link',
        },
      ];
      const tapAction = {
        type: 'OPEN_NOTIFICATION',
        value: 'notification-detail',
        destructive: 'false',
        icon: 'eye',
        title: 'View Details',
      };

      const { body, query, params, headers } = createTestData({
        body: {
          body: 'Message content',
        },
        query: {
          subtitle: 'Query Subtitle',
          sound: 'query-sound.wav',
          snoozes: '5,10,15,30',
          attachments: JSON.stringify(attachments),
        },
        headers: {
          'x-message-locale': 'en-US',
          'x-message-addMarkAsReadAction': 'true',
          'x-message-actions': JSON.stringify(actions),
          'x-message-tapAction': JSON.stringify(tapAction),
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.body).toBe('Message content');
      expect(result.bucketId).toBe('bucket-1');
      expect(result.deliveryType).toBe('NORMAL');
      expect(result.subtitle).toBe('Query Subtitle');
      expect(result.sound).toBe('query-sound.wav');
      expect(result.snoozes).toEqual([5, 10, 15, 30]);
      expect(result.attachments).toEqual(attachments);
      expect(result.locale).toBe('en-US');
      expect(result.addMarkAsReadAction).toBe(true);
      expect(result.actions).toEqual(actions);
      expect(result.tapAction).toEqual(tapAction);
    });

    it('should handle data override scenarios correctly', () => {
      const { body, query, params, headers } = createTestData({
        body: {
          subtitle: 'Body Subtitle',
          sound: 'body-sound.wav',
        },
        query: {
          subtitle: 'Query Subtitle',
          sound: 'query-sound.wav',
          locale: 'en-US',
        },
        headers: {
          'x-message-subtitle': 'Header Subtitle',
          'x-message-locale': 'it-IT',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.subtitle).toBe('Header Subtitle');
      expect(result.sound).toBe('query-sound.wav');
      expect(result.locale).toBe('it-IT');
    });
  });

  describe('Template data collection', () => {
    it('should collect template-* parameters from query params', () => {
      const { body, query, params, headers } = createTestData({
        query: {
          'template-user': 'John Doe',
          'template-status': 'active',
          'template-count': '42',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData).toEqual({
        user: 'John Doe',
        status: 'active',
        count: '42',
      });
    });

    it('should collect template-* parameters from headers', () => {
      const { body, query, params, headers } = createTestData({
        headers: {
          'template-user': 'Jane Doe',
          'template-role': 'admin',
          'template-enabled': 'true',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData).toEqual({
        user: 'Jane Doe',
        role: 'admin',
        enabled: 'true',
      });
    });

    it('should merge template-* from query and headers (headers take precedence)', () => {
      const { body, query, params, headers } = createTestData({
        query: {
          'template-user': 'John Doe',
          'template-status': 'pending',
        },
        headers: {
          'template-status': 'active',
          'template-role': 'user',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData).toEqual({
        user: 'John Doe',
        status: 'active',
        role: 'user',
      });
    });

    it('should merge template-* params with existing templateData from body', () => {
      const { body, query, params, headers } = createTestData({
        body: {
          templateData: {
            existing: 'value',
            count: 10,
          },
        },
        query: {
          'template-user': 'John Doe',
          'template-count': '20',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData).toEqual({
        existing: 'value',
        count: '20',
        user: 'John Doe',
      });
    });

    it('should handle templateData as JSON string in body', () => {
      const templateData = {
        user: 'John Doe',
        items: ['item1', 'item2'],
      };
      const { body, query, params, headers } = createTestData({
        body: { templateData: JSON.stringify(templateData) },
        query: { 'template-status': 'active' },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData).toEqual({
        ...templateData,
        status: 'active',
      });
    });

    it('should handle complex nested objects in template-* params', () => {
      const user = {
        name: 'John Doe',
        email: 'john@example.com',
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      };
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const { body, query, params, headers } = createTestData({
        query: {
          'template-user': JSON.stringify(user),
          'template-items': JSON.stringify(items),
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData.user).toEqual(user);
      expect(result.templateData.items).toEqual(items);
    });

    it('should handle arrays in template-* params', () => {
      const tags = ['tag1', 'tag2', 'tag3'];
      const numbers = [1, 2, 3, 4, 5];
      const { body, query, params, headers } = createTestData({
        query: {
          'template-tags': JSON.stringify(tags),
          'template-numbers': JSON.stringify(numbers),
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData.tags).toEqual(tags);
      expect(result.templateData.numbers).toEqual(numbers);
    });

    it('should handle nested objects in template-* headers', () => {
      const metadata = {
        source: 'api',
        timestamp: '2024-01-01T00:00:00Z',
        nested: {
          level1: {
            level2: 'deep value',
          },
        },
      };
      const { body, query, params, headers } = createTestData({
        headers: {
          'template-metadata': JSON.stringify(metadata),
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData.metadata).toEqual(metadata);
    });

    it('should ignore non-template-* parameters when collecting template data', () => {
      const { body, query, params, headers } = createTestData({
        query: {
          'template-user': 'John Doe',
          'x-message-subtitle': 'Subtitle',
          'other-param': 'ignored',
        },
        headers: {
          'template-status': 'active',
          'x-message-sound': 'sound.wav',
          'authorization': 'Bearer token',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData).toEqual({
        user: 'John Doe',
        status: 'active',
      });
      expect(result.templateData['x-message-subtitle']).toBeUndefined();
      expect(result.templateData['other-param']).toBeUndefined();
      expect(result.templateData['authorization']).toBeUndefined();
    });

    it('should handle template-* with null and undefined values', () => {
      const { body, query, params, headers } = createTestData({
        query: {
          'template-user': 'John Doe',
          'template-null-value': null,
          'template-undefined-value': undefined,
        },
        headers: {
          'template-empty': '',
        },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData.user).toBe('John Doe');
      expect(result.templateData['null-value']).toBeUndefined();
      expect(result.templateData['undefined-value']).toBeUndefined();
      expect(result.templateData.empty).toBe('');
    });

    it('should handle invalid JSON in templateData string', () => {
      const { body, query, params, headers } = createTestData({
        body: { templateData: 'invalid json string' },
      });

      const result = combineMessageSources(body, query, params, headers);

      expect(result.templateData).toBe('invalid json string');
    });
  });
});
