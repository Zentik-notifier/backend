import { Test, TestingModule } from '@nestjs/testing';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { AuthentikParser } from './authentik.parser';
import { ServarrParser } from './servarr.parser';
import { BuiltinParserService } from './builtin-parser.service';
import { BuiltinParserLoggerService } from './builtin-parser-logger.service';

describe('BuiltinParserService', () => {
  let service: BuiltinParserService;
  let authentikParser: AuthentikParser;
  let servarrParser: ServarrParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BuiltinParserService, AuthentikParser, ServarrParser, BuiltinParserLoggerService],
    }).compile();

    service = module.get<BuiltinParserService>(BuiltinParserService);
    authentikParser = module.get<AuthentikParser>(AuthentikParser);
    servarrParser = module.get<ServarrParser>(ServarrParser);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getParser', () => {
    it('should return parser by name', () => {
      const parser = service.getParser('authentik');
      expect(parser).toBe(authentikParser);
    });

    it('should return parser by capitalized name', () => {
      const parser = service.getParser('Authentik');
      expect(parser).toBe(authentikParser);
    });

    it('should return parser by enum type', () => {
      const parser = service.getParser(PayloadMapperBuiltInType.ZentikAuthentik);
      expect(parser).toBe(authentikParser);
    });

    it('should return servarr parser by name', () => {
      const parser = service.getParser('servarr');
      expect(parser).toBe(servarrParser);
    });

    it('should return servarr parser by capitalized name', () => {
      const parser = service.getParser('Servarr');
      expect(parser).toBe(servarrParser);
    });

    it('should return servarr parser by enum type', () => {
      const parser = service.getParser(PayloadMapperBuiltInType.ZentikServarr);
      expect(parser).toBe(servarrParser);
    });

    it('should throw error for unknown parser', () => {
      expect(() => {
        service.getParser('unknown');
      }).toThrow('Builtin parser not found: unknown');
    });
  });

  describe('hasParser', () => {
    it('should return true for existing parser by name', () => {
      expect(service.hasParser('authentik')).toBe(true);
    });

    it('should return true for existing parser by capitalized name', () => {
      expect(service.hasParser('Authentik')).toBe(true);
    });

    it('should return true for existing parser by enum type', () => {
      expect(service.hasParser(PayloadMapperBuiltInType.ZentikAuthentik)).toBe(true);
    });

    it('should return true for servarr parser by name', () => {
      expect(service.hasParser('servarr')).toBe(true);
    });

    it('should return true for servarr parser by capitalized name', () => {
      expect(service.hasParser('Servarr')).toBe(true);
    });

    it('should return true for servarr parser by enum type', () => {
      expect(service.hasParser(PayloadMapperBuiltInType.ZentikServarr)).toBe(true);
    });

    it('should return false for unknown parser', () => {
      expect(service.hasParser('unknown')).toBe(false);
    });
  });

  describe('getAllParsers', () => {
    it('should return all registered parsers', () => {
      const parsers = service.getAllParsers();
      
      expect(parsers).toHaveLength(2);
      expect(parsers).toContainEqual({
        name: 'Authentik',
        type: PayloadMapperBuiltInType.ZentikAuthentik,
        description: 'Parser for Authentik notifications - handles login, logout, registration and other events',
      });
      expect(parsers).toContainEqual({
        name: 'Servarr',
        type: PayloadMapperBuiltInType.ZentikServarr,
        description: 'Parser for Servarr applications (Radarr, Sonarr, etc.) - handles movie/TV show download and import events',
      });
    });
  });

  describe('transformPayload', () => {
    const mockPayload = {
      user_email: 'test@example.com',
      user_username: 'testuser',
      body: 'User testuser logged in successfully: {"userAgent": "Mozilla/5.0..."}',
      severity: 'info',
    };

    it('should transform payload using correct parser', () => {
      const result = service.transformPayload('authentik', mockPayload);

      expect(result).toEqual({
        title: 'Login: testuser',
        subtitle: 'test@example.com',
        body: 'testuser\nUser agent: Mozilla/5.0...',
        deliveryType: 'NORMAL',
        bucketId: '',
      });
    });

    it('should throw error for unknown parser', () => {
      expect(() => {
        service.transformPayload('unknown', mockPayload);
      }).toThrow('Builtin parser not found: unknown');
    });
  });

  describe('validatePayload', () => {
    const validPayload = {
      user_email: 'test@example.com',
      user_username: 'testuser',
      body: 'User testuser logged in successfully',
    };

    it('should validate payload using correct parser', () => {
      const result = service.validatePayload('authentik', validPayload);
      expect(result).toBe(false);
    });

    it('should return false for unknown parser', () => {
      const result = service.validatePayload('unknown', validPayload);
      expect(result).toBe(false);
    });
  });

});
