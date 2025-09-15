import { Test, TestingModule } from '@nestjs/testing';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { AuthentikParser } from './authentik.parser';

describe('AuthentikParser', () => {
  let parser: AuthentikParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthentikParser],
    }).compile();

    parser = module.get<AuthentikParser>(AuthentikParser);
  });

  it('should be defined', () => {
    expect(parser).toBeDefined();
  });

  describe('builtInType', () => {
    it('should return ZENTIK_AUTHENTIK', () => {
      expect(parser.builtInType).toBe(PayloadMapperBuiltInType.ZentikAuthentik);
    });
  });

  describe('validate', () => {
    it('should return true for valid payload with user_email and user_username', () => {
      const payload = {
        user_email: 'test@example.com',
        user_username: 'testuser',
        body: 'User testuser logged in',
        severity: 'info',
      };

      expect(parser.validate(payload)).toBe(true);
    });

    it('should return true for valid payload with event_user_email and event_user_username', () => {
      const payload = {
        event_user_email: 'test@example.com',
        event_user_username: 'testuser',
        body: 'User testuser logged in',
        severity: 'info',
      };

      expect(parser.validate(payload)).toBe(true);
    });

    it('should return true for valid payload with mixed user and event fields', () => {
      const payload = {
        user_email: 'test@example.com',
        event_user_username: 'testuser',
        body: 'User testuser logged in',
        severity: 'info',
      };

      expect(parser.validate(payload)).toBe(true);
    });

    it('should return false for payload without email', () => {
      const payload = {
        user_username: 'testuser',
        body: 'User testuser logged in',
        severity: 'info',
      };

      expect(parser.validate(payload)).toBe(false);
    });

    it('should return false for payload without username', () => {
      const payload = {
        user_email: 'test@example.com',
        body: 'User testuser logged in',
        severity: 'info',
      };

      expect(parser.validate(payload)).toBe(false);
    });

    it('should return false for empty payload', () => {
      const payload = {};

      expect(parser.validate(payload)).toBe(false);
    });
  });

  describe('parse', () => {
    const mockPayload = {
      user_email: 'test@example.com',
      user_username: 'testuser',
      body: 'User testuser logged in successfully: {"userAgent": "Mozilla/5.0...", "pathNext": "/if/admin/", "authMethod": "password", "asn": {"asn": 16509, "as_org": "AMAZON-02", "network": "3.96.0.0/11"}, "geo": {"lat": 50.1169, "city": "Frankfurt am Main", "long": 8.6837, "country": "DE", "continent": "EU"}}',
      severity: 'info',
    };

    it('should parse loginSuccess event correctly', () => {
      const payload = {
        ...mockPayload,
        body: 'User testuser logged in successfully: {"userAgent": "Mozilla/5.0...", "pathNext": "/if/admin/", "authMethod": "password", "asn": {"asn": 16509, "as_org": "AMAZON-02", "network": "3.96.0.0/11"}, "geo": {"lat": 50.1169, "city": "Frankfurt am Main", "long": 8.6837, "country": "DE", "continent": "EU"}}',
      };

      const result = parser.parse(payload);

      expect(result).toEqual({
        title: 'Login: testuser',
        subtitle: 'test@example.com',
        body: 'testuser\nUser agent: Mozilla/5.0...\nAuthentication method: password\nASN: 16509 (AMAZON-02)\nLocation: Frankfurt am Main, DE',
        deliveryType: 'NORMAL',
        bucketId: '',
      });
    });

    it('should parse loginFailed event correctly', () => {
      const payload = {
        ...mockPayload,
        body: 'User testuser failed to log in: {"userAgent": "Mozilla/5.0...", "pathNext": "/if/admin/", "authMethod": "password", "asn": {"asn": 16509, "as_org": "AMAZON-02", "network": "3.96.0.0/11"}, "geo": {"lat": 50.1169, "city": "Frankfurt am Main", "long": 8.6837, "country": "DE", "continent": "EU"}}',
      };

      const result = parser.parse(payload);

      expect(result).toEqual({
        title: 'Login_failed: testuser',
        subtitle: 'test@example.com',
        body: 'testuser\nUser agent: Mozilla/5.0...\nAuthentication method: password\nASN: 16509 (AMAZON-02)\nLocation: Frankfurt am Main, DE',
        deliveryType: 'CRITICAL',
        bucketId: '',
      });
    });

    it('should parse logout event correctly', () => {
      const payload = {
        ...mockPayload,
        body: 'User testuser logged out: {"userAgent": "Mozilla/5.0...", "pathNext": "/if/admin/", "authMethod": "password", "asn": {"asn": 16509, "as_org": "AMAZON-02", "network": "3.96.0.0/11"}, "geo": {"lat": 50.1169, "city": "Frankfurt am Main", "long": 8.6837, "country": "DE", "continent": "EU"}}',
      };

      const result = parser.parse(payload);

      expect(result).toEqual({
        title: 'Logout: testuser',
        subtitle: 'test@example.com',
        body: 'testuser\nUser agent: Mozilla/5.0...\nAuthentication method: password\nASN: 16509 (AMAZON-02)\nLocation: Frankfurt am Main, DE',
        deliveryType: 'NORMAL',
        bucketId: '',
      });
    });

    it('should handle unmapped events correctly', () => {
      const payload = {
        ...mockPayload,
        body: 'User testuser performed some unknown action: {"some": "data"}',
      };

      const result = parser.parse(payload);

      expect(result).toEqual({
        title: 'Unknown - Unmapped event',
        subtitle: '',
        body: 'User testuser performed some unknown action: {"some": "data"}',
        deliveryType: 'NORMAL',
        bucketId: '',
      });
    });

    it('should handle Python-style JSON in body', () => {
      const payload = {
        ...mockPayload,
        body: 'User testuser logged in successfully: {\'userAgent\': \'Mozilla/5.0...\', \'pathNext\': \'/if/admin/\', \'authMethod\': \'password\', \'asn\': {\'asn\': 16509, \'as_org\': \'AMAZON-02\', \'network\': \'3.96.0.0/11\'}, \'geo\': {\'lat\': 50.1169, \'city\': \'Frankfurt am Main\', \'long\': 8.6837, \'country\': \'DE\', \'continent\': \'EU\'}}',
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Login: testuser');
      expect(result.subtitle).toBe('test@example.com');
    });

    it('should handle Python boolean and null values in JSON', () => {
      const payload = {
        ...mockPayload,
        body: 'User testuser logged in successfully: {\'userAgent\': \'Mozilla/5.0...\', \'pathNext\': \'/if/admin/\', \'authMethod\': \'password\', \'asn\': {\'asn\': 16509, \'as_org\': \'AMAZON-02\', \'network\': \'3.96.0.0/11\', \'isValid\': True, \'isBlocked\': False, \'parent\': None}, \'geo\': {\'lat\': 50.1169, \'city\': \'Frankfurt am Main\', \'long\': 8.6837, \'country\': \'DE\', \'continent\': \'EU\'}}',
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Login: testuser');
      expect(result.subtitle).toBe('test@example.com');
    });

    it('should handle payload with event_user fields', () => {
      const payload = {
        event_user_email: 'event@example.com',
        event_user_username: 'eventuser',
        body: 'User eventuser logged in successfully: {"userAgent": "Mozilla/5.0..."}',
        severity: 'info',
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Login: eventuser');
      expect(result.subtitle).toBe('event@example.com');
    });

    it('should handle payload with mixed user and event fields', () => {
      const payload = {
        user_email: 'user@example.com',
        event_user_username: 'eventuser',
        body: 'User eventuser logged in successfully: {"userAgent": "Mozilla/5.0..."}',
        severity: 'info',
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Login: eventuser');
      expect(result.subtitle).toBe('user@example.com');
    });

    it('should handle body without JSON data', () => {
      const payload = {
        ...mockPayload,
        body: 'User testuser logged in successfully',
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Login: testuser');
      expect(result.subtitle).toBe('test@example.com');
      expect(result.body).toBe('testuser');
    });

    it('should handle invalid JSON gracefully', () => {
      const payload = {
        ...mockPayload,
        body: 'User testuser logged in successfully: {invalid json}',
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Login: testuser');
      expect(result.subtitle).toBe('test@example.com');
      expect(result.body).toBe('testuser');
    });

    it('should parse updateAvailable event correctly', () => {
      const payload = {
        user_email: 'email-user@gmail.com',
        user_username: 'username',
        body: 'New version 2025.8.2 available!',
        severity: 'notice',
      };

      const result = parser.parse(payload);

      expect(result).toEqual({
        title: 'Update Available',
        subtitle: 'email-user@gmail.com',
        body: 'New version 2025.8.2 available!',
        deliveryType: 'NORMAL',
        bucketId: '',
      });
    });
  });

  describe('extractEventTypeFromBody', () => {
    it('should extract loginSuccess from body', () => {
      const body = 'User testuser logged in successfully: {"data": "value"}';
      const result = parser['extractEventTypeFromBody'](body);
      expect(result).toBe('loginSuccess');
    });

    it('should extract loginFailed from body', () => {
      const body = 'User testuser failed to log in: {"data": "value"}';
      const result = parser['extractEventTypeFromBody'](body);
      expect(result).toBe('loginFailed');
    });

    it('should extract logout from body', () => {
      const body = 'User testuser logged out: {"data": "value"}';
      const result = parser['extractEventTypeFromBody'](body);
      expect(result).toBe('logout');
    });

    it('should return unknown for unrecognized events', () => {
      const body = 'User testuser performed some action: {"data": "value"}';
      const result = parser['extractEventTypeFromBody'](body);
      expect(result).toBe('unknown');
    });

    it('should extract updateAvailable from body', () => {
      const body = 'New version 2025.8.2 available!';
      const result = parser['extractEventTypeFromBody'](body);
      expect(result).toBe('updateAvailable');
    });
  });

  describe('extractDataFromBody', () => {
    it('should extract JSON data from body', () => {
      const body = 'User testuser logged in: {"userAgent": "Mozilla/5.0", "pathNext": "/admin"}';
      const result = parser['extractDataFromBody'](body);
      
      expect(result).toEqual({
        userAgent: 'Mozilla/5.0',
        pathNext: '/admin',
      });
    });

    it('should return empty object when no JSON found', () => {
      const body = 'User testuser logged in';
      const result = parser['extractDataFromBody'](body);
      
      expect(result).toEqual({});
    });

    it('should handle Python-style single quotes', () => {
      const body = 'User testuser logged in: {\'userAgent\': \'Mozilla/5.0\', \'pathNext\': \'/admin\'}';
      const result = parser['extractDataFromBody'](body);
      
      expect(result).toEqual({
        userAgent: 'Mozilla/5.0',
        pathNext: '/admin',
      });
    });

    it('should handle Python boolean and null values', () => {
      const body = 'User testuser logged in: {\'isValid\': True, \'isBlocked\': False, \'parent\': None}';
      const result = parser['extractDataFromBody'](body);
      
      expect(result).toEqual({
        asn: undefined,
        authMethod: undefined,
        authMethodArgs: undefined,
        geo: undefined,
        password: undefined,
        pathNext: undefined,
        stage: undefined,
        userAgent: undefined,
        username: undefined,
      });
    });

    it('should handle invalid JSON gracefully', () => {
      const body = 'User testuser logged in: {invalid json}';
      const result = parser['extractDataFromBody'](body);
      
      expect(result).toEqual({});
    });
  });
});
