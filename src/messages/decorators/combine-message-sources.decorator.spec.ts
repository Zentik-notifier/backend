
describe('CombineMessageSources Decorator Logic', () => {
  // Testa la logica interna del decoratore direttamente
  const combineMessageSources = (body: any = {}, query: any = {}, params: any = {}, headers: any = {}) => {
    // Start with body data as base
    const messageData: any = { ...body };

    // Override with query parameters (query takes precedence over body)
    if (query) {
      Object.keys(query).forEach(key => {
        if (query[key] !== undefined && query[key] !== null) {
          messageData[key] = query[key];
        }
      });
    }

    // Override with path parameters (params take precedence over query and body)
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          messageData[key] = params[key];
        }
      });
    }

    // Override with header values (headers take highest precedence)
    // Only process headers that start with 'x-message-'
    if (headers) {
      Object.keys(headers).forEach(key => {
        if (key.startsWith('x-message-') && headers[key] !== undefined && headers[key] !== null) {
          // Remove 'x-message-' prefix and convert to camelCase
          const cleanKey = key.replace('x-message-', '');
          messageData[cleanKey] = headers[key];
        }
      });
    }

    // Handle special transformations for specific fields
    if (messageData.snoozes && typeof messageData.snoozes === 'string') {
      messageData.snoozes = messageData.snoozes.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
    }

    if (messageData.attachments && typeof messageData.attachments === 'string') {
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
      'destructive'
    ];

    booleanFields.forEach(field => {
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
      const body = { title: 'Body Title', subtitle: 'Body Subtitle' };
      const query = { subtitle: 'Query Subtitle', sound: 'query-sound.wav' };
      const headers = { 'x-message-subtitle': 'Header Subtitle', 'x-message-sound': 'header-sound.wav' };
      const params = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.subtitle).toBe('Header Subtitle'); // Header dovrebbe sovrascrivere query
      expect(result.sound).toBe('header-sound.wav');   // Header dovrebbe sovrascrivere query
    });

    it('should prioritize query params over body', () => {
      const body = { title: 'Body Title', subtitle: 'Body Subtitle' };
      const query = { subtitle: 'Query Subtitle', sound: 'query-sound.wav' };
      const headers = {};
      const params = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.subtitle).toBe('Query Subtitle'); // Query dovrebbe sovrascrivere body
      expect(result.sound).toBe('query-sound.wav');   // Query dovrebbe sovrascrivere body
    });

    it('should use body as base when no other sources provided', () => {
      const body = { title: 'Body Title', subtitle: 'Body Subtitle' };
      const query = {};
      const headers = {};
      const params = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.subtitle).toBe('Body Subtitle');
    });
  });

  describe('Header processing', () => {
    it('should only process headers starting with x-message-', () => {
      const body = { title: 'Body Title' };
      const query = {};
      const params = {};
      const headers = {
        'x-message-subtitle': 'Header Subtitle',
        'x-message-sound': 'header-sound.wav',
        'authorization': 'Bearer token',
        'content-type': 'application/json',
        'x-other-header': 'Other Value',
      };

      const result = combineMessageSources(body, query, params, headers);

      expect(result.subtitle).toBe('Header Subtitle');
      expect(result.sound).toBe('header-sound.wav');
      expect(result.authorization).toBeUndefined();
      expect(result['content-type']).toBeUndefined();
      expect(result['x-other-header']).toBeUndefined();
    });

    it('should remove x-message- prefix from header keys', () => {
      const body = { title: 'Body Title' };
      const query = {};
      const params = {};
      const headers = {
        'x-message-subtitle': 'Header Subtitle',
        'x-message-addMarkAsReadAction': 'true',
        'x-message-locale': 'en-US',
      };

      const result = combineMessageSources(body, query, params, headers);

      expect(result.subtitle).toBe('Header Subtitle');
      expect(result.addMarkAsReadAction).toBe(true); // La trasformazione booleana viene applicata
      expect(result.locale).toBe('en-US');
    });

    it('should handle undefined and null header values', () => {
      const body = { title: 'Body Title' };
      const query = {};
      const params = {};
      const headers = {
        'x-message-subtitle': undefined,
        'x-message-sound': null,
        'x-message-locale': '',
      };

      const result = combineMessageSources(body, query, params, headers);

      expect(result.subtitle).toBeUndefined();
      expect(result.sound).toBeUndefined(); // Headers null non vengono aggiunti
      expect(result.locale).toBe('');
    });
  });

  describe('Array transformations', () => {
    it('should transform snoozes string to array', () => {
      const body = { title: 'Body Title' };
      const query = { snoozes: '15,30,60,120' };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.snoozes).toEqual([15, 30, 60, 120]);
    });

    it('should handle empty snoozes string', () => {
      const body = { title: 'Body Title' };
      const query = { snoozes: '' };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.snoozes).toBe(''); // Stringa vuota non viene trasformata in array vuoto
    });

    it('should handle invalid snoozes string', () => {
      const body = { title: 'Body Title' };
      const query = { snoozes: '15,invalid,30,60' };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.snoozes).toEqual([15, 30, 60]);
    });

    it('should transform attachments JSON string to array', () => {
      const body = { title: 'Body Title' };
      const query = {
        attachments: JSON.stringify([
          { mediaType: 'IMAGE', name: 'test.jpg' },
          { mediaType: 'VIDEO', name: 'test.mp4' },
        ]),
      };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.attachments).toEqual([
        { mediaType: 'IMAGE', name: 'test.jpg' },
        { mediaType: 'VIDEO', name: 'test.mp4' },
      ]);
    });

    it('should handle invalid JSON attachments string', () => {
      const body = { title: 'Body Title' };
      const query = { attachments: 'invalid json string' };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.attachments).toBe('invalid json string');
    });

    it('should transform actions JSON string to array', () => {
      const body = { title: 'Body Title' };
      const query = {
        actions: JSON.stringify([
          { type: 'NAVIGATE', value: 'https://example.com', destructive: 'false', icon: 'link', title: 'Open Link' },
        ]),
      };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.actions).toEqual([
        { type: 'NAVIGATE', value: 'https://example.com', destructive: 'false', icon: 'link', title: 'Open Link' },
      ]);
    });

    it('should transform tapAction JSON string to object', () => {
      const body = { title: 'Body Title' };
      const query = {
        tapAction: JSON.stringify({
          type: 'OPEN_NOTIFICATION',
          value: 'notification-detail',
          destructive: 'false',
          icon: 'eye',
          title: 'View Details',
        }),
      };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.tapAction).toEqual({
        type: 'OPEN_NOTIFICATION',
        value: 'notification-detail',
        destructive: 'false',
        icon: 'eye',
        title: 'View Details',
      });
    });
  });

  describe('Boolean transformations', () => {
    it('should transform boolean fields from strings to booleans', () => {
      const body = { title: 'Body Title' };
      const query = {
        addMarkAsReadAction: 'true',
        addOpenNotificationAction: 'false',
        addDeleteAction: 'true',
      };
      const params = {};
      const headers = {
        'x-message-saveOnServer': 'false',
        'x-message-destructive': 'true',
      };

      const result = combineMessageSources(body, query, params, headers);

      expect(result.addMarkAsReadAction).toBe(true);
      expect(result.addOpenNotificationAction).toBe(false);
      expect(result.addDeleteAction).toBe(true);
      expect(result.saveOnServer).toBe(false);
      expect(result.destructive).toBe(true);
    });

    it('should handle case-insensitive boolean strings', () => {
      const body = { title: 'Body Title' };
      const query = {
        addMarkAsReadAction: 'TRUE',
        addOpenNotificationAction: 'False',
        addDeleteAction: 'True',
      };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.addMarkAsReadAction).toBe(true);
      expect(result.addOpenNotificationAction).toBe(false);
      expect(result.addDeleteAction).toBe(true);
    });

    it('should handle empty string as false for boolean fields', () => {
      const body = { title: 'Body Title' };
      const query = {
        addMarkAsReadAction: '',
        addOpenNotificationAction: 'false',
      };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.addMarkAsReadAction).toBe(false);
      expect(result.addOpenNotificationAction).toBe(false);
    });

    it('should preserve non-string boolean values', () => {
      const body = { title: 'Body Title' };
      const query = {
        addMarkAsReadAction: true,
        addOpenNotificationAction: false,
      };
      const params = {};
      const headers = {};

      const result = combineMessageSources(body, query, params, headers);

      expect(result.addMarkAsReadAction).toBe(true);
      expect(result.addOpenNotificationAction).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined request properties', () => {
      const result = combineMessageSources();

      expect(result).toEqual({});
    });

    it('should handle null values in all sources', () => {
      const body = { title: 'Body Title', subtitle: null };
      const query = { sound: null, locale: null };
      const params = {};
      const headers = { 'x-message-addMarkAsReadAction': null };

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.subtitle).toBeNull();
      expect(result.sound).toBeUndefined(); // Query null non viene aggiunto
      expect(result.locale).toBeUndefined(); // Query null non viene aggiunto
      expect(result.addMarkAsReadAction).toBeUndefined(); // Headers null non vengono aggiunti
    });

    it('should handle empty objects and arrays', () => {
      const body = { title: 'Body Title', attachments: [] };
      const query = { actions: '[]', snoozes: '' };
      const params = {};
      const headers = { 'x-message-tapAction': '{}' };

      const result = combineMessageSources(body, query, params, headers);

      expect(result.title).toBe('Body Title');
      expect(result.attachments).toEqual([]);
      expect(result.actions).toEqual([]);
      expect(result.snoozes).toBe(''); // Stringa vuota non viene trasformata
      expect(result.tapAction).toEqual({});
    });

    it('should preserve original data types when no transformation needed', () => {
      const body = { title: 'Body Title', count: 42, isActive: true };
      const query = { tags: ['tag1', 'tag2'], metadata: { key: 'value' } };
      const params = {};
      const headers = { 'x-message-priority': 'high' };

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
      const body = {
        title: 'Complex Message',
        body: 'Message content',
        bucketId: 'bucket-1',
        deliveryType: 'NORMAL',
      };
      const query = {
        subtitle: 'Query Subtitle',
        sound: 'query-sound.wav',
        snoozes: '5,10,15,30',
        attachments: JSON.stringify([
          { mediaType: 'IMAGE', name: 'query-image.jpg' },
        ]),
      };
      const params = {};
      const headers = {
        'x-message-locale': 'en-US',
        'x-message-addMarkAsReadAction': 'true',
        'x-message-actions': JSON.stringify([
          { type: 'NAVIGATE', value: 'https://example.com', destructive: 'false', icon: 'link', title: 'Open Link' },
        ]),
        'x-message-tapAction': JSON.stringify({
          type: 'OPEN_NOTIFICATION',
          value: 'notification-detail',
          destructive: 'false',
          icon: 'eye',
          title: 'View Details',
        }),
      };

      const result = combineMessageSources(body, query, params, headers);

      // Verifica che tutti i dati siano combinati correttamente
      expect(result.title).toBe('Complex Message');
      expect(result.body).toBe('Message content');
      expect(result.bucketId).toBe('bucket-1');
      expect(result.deliveryType).toBe('NORMAL');
      expect(result.subtitle).toBe('Query Subtitle');
      expect(result.sound).toBe('query-sound.wav');
      expect(result.snoozes).toEqual([5, 10, 15, 30]);
      expect(result.attachments).toEqual([
        { mediaType: 'IMAGE', name: 'query-image.jpg' },
      ]);
      expect(result.locale).toBe('en-US');
      expect(result.addMarkAsReadAction).toBe(true);
      expect(result.actions).toEqual([
        { type: 'NAVIGATE', value: 'https://example.com', destructive: 'false', icon: 'link', title: 'Open Link' },
      ]);
      expect(result.tapAction).toEqual({
        type: 'OPEN_NOTIFICATION',
        value: 'notification-detail',
        destructive: 'false',
        icon: 'eye',
        title: 'View Details',
      });
    });

    it('should handle data override scenarios correctly', () => {
      const body = { title: 'Body Title', subtitle: 'Body Subtitle', sound: 'body-sound.wav' };
      const query = { subtitle: 'Query Subtitle', sound: 'query-sound.wav', locale: 'en-US' };
      const params = {};
      const headers = { 'x-message-subtitle': 'Header Subtitle', 'x-message-locale': 'it-IT' };

      const result = combineMessageSources(body, query, params, headers);

      // Verifica la precedenza: headers > query > body
      expect(result.title).toBe('Body Title');           // Solo in body
      expect(result.subtitle).toBe('Header Subtitle');   // Header sovrascrive query
      expect(result.sound).toBe('query-sound.wav');      // Query sovrascrive body
      expect(result.locale).toBe('it-IT');               // Header sovrascrive query
    });
  });
});
