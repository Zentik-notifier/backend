import { Test, TestingModule } from '@nestjs/testing';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { AuthentikParser } from './authentik.parser';
import { ServarrParser } from './servarr.parser';
import { RailwayParser } from './railway.parser';
import { GitHubParser } from './github.parser';
import { ExpoParser } from './expo.parser';
import { BuiltinParserService } from './builtin-parser.service';
import { BuiltinParserLoggerService } from './builtin-parser-logger.service';
import { UsersService } from '../../users/users.service';

describe('BuiltinParserService', () => {
  let service: BuiltinParserService;
  let authentikParser: AuthentikParser;
  let servarrParser: ServarrParser;
  let expoParser: ExpoParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuiltinParserService,
        AuthentikParser,
        ServarrParser,
        RailwayParser,
        GitHubParser,
        ExpoParser,
        BuiltinParserLoggerService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({}),
            findById: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<BuiltinParserService>(BuiltinParserService);
    authentikParser = module.get<AuthentikParser>(AuthentikParser);
    servarrParser = module.get<ServarrParser>(ServarrParser);
    expoParser = module.get<ExpoParser>(ExpoParser);
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
      const parser =       service.getParser(
        PayloadMapperBuiltInType.ZENTIK_AUTHENTIK,
      );
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
      const parser = service.getParser(PayloadMapperBuiltInType.ZENTIK_SERVARR);
      expect(parser).toBe(servarrParser);
    });

    it('should return expo parser by name', () => {
      const parser = service.getParser('expo');
      expect(parser).toBe(expoParser);
    });

    it('should return expo parser by capitalized name', () => {
      const parser = service.getParser('Expo');
      expect(parser).toBe(expoParser);
    });

    it('should return expo parser by enum type', () => {
      const parser = service.getParser(PayloadMapperBuiltInType.ZENTIK_EXPO);
      expect(parser).toBe(expoParser);
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
      expect(service.hasParser(PayloadMapperBuiltInType.ZENTIK_AUTHENTIK)).toBe(
        true,
      );
    });

    it('should return true for servarr parser by name', () => {
      expect(service.hasParser('servarr')).toBe(true);
    });

    it('should return true for servarr parser by capitalized name', () => {
      expect(service.hasParser('Servarr')).toBe(true);
    });

    it('should return true for servarr parser by enum type', () => {
      expect(service.hasParser(PayloadMapperBuiltInType.ZENTIK_SERVARR)).toBe(
        true,
      );
    });

    it('should return true for expo parser by name', () => {
      expect(service.hasParser('expo')).toBe(true);
    });

    it('should return true for expo parser by capitalized name', () => {
      expect(service.hasParser('Expo')).toBe(true);
    });

    it('should return true for expo parser by enum type', () => {
      expect(service.hasParser(PayloadMapperBuiltInType.ZENTIK_EXPO)).toBe(
        true,
      );
    });

    it('should return false for unknown parser', () => {
      expect(service.hasParser('unknown')).toBe(false);
    });
  });

  describe('getAllParsers', () => {
    it('should return all registered parsers', () => {
      const parsers = service.getAllParsers();

      expect(parsers).toHaveLength(5);
      expect(parsers).toContainEqual({
        name: 'Authentik',
        type: PayloadMapperBuiltInType.ZENTIK_AUTHENTIK,
        description:
          'Parser for Authentik notifications - handles login, logout, registration, update available and other events',
      });
      expect(parsers).toContainEqual({
        name: 'Servarr',
        type: PayloadMapperBuiltInType.ZENTIK_SERVARR,
        description:
          'Parser for Servarr applications (Radarr, Sonarr, Prowlarr, etc.) - handles movie/TV show download and import events, indexer events, health check notifications, application update events, and unknown payloads',
      });
      expect(parsers).toContainEqual({
        name: 'ZentikRailway',
        type: PayloadMapperBuiltInType.ZENTIK_RAILWAY,
        description:
          'Parser for Railway webhooks - handles deployment and alert events',
      });
      expect(parsers).toContainEqual({
        name: 'ZentikGitHub',
        type: PayloadMapperBuiltInType.ZENTIK_GITHUB,
        description:
          'Parser for GitHub webhooks - handles push, pull requests, issues, releases, workflows, and more',
      });
      expect(parsers).toContainEqual({
        name: 'Expo',
        type: PayloadMapperBuiltInType.ZENTIK_EXPO,
        description:
          'Parser for Expo Application Services (EAS) webhooks - handles build and submit events',
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

    it('should transform payload using correct parser', async () => {
      const result = await service.transformPayload('authentik', mockPayload);

      expect(result).toEqual({
        title: 'Login: testuser',
        subtitle: 'test@example.com',
        body: 'testuser\nUser agent: Mozilla/5.0...',
        deliveryType: 'NORMAL',
        bucketId: '',
      });
    });

    it('should throw error for unknown parser', async () => {
      await expect(
        service.transformPayload('unknown', mockPayload)
      ).rejects.toThrow('Builtin parser not found: unknown');
    });
  });

  describe('validatePayload', () => {
    const validPayload = {
      user_email: 'test@example.com',
      user_username: 'testuser',
      body: 'User testuser logged in successfully',
    };

    it('should validate payload using correct parser', async () => {
      const result = await service.validatePayload('authentik', validPayload);
      expect(result).toBe(false);
    });

    it('should return false for unknown parser', async () => {
      const result = await service.validatePayload('unknown', validPayload);
      expect(result).toBe(false);
    });
  });
});
