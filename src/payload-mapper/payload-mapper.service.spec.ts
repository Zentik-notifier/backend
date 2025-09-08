import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayloadMapper } from '../entities/payload-mapper.entity';
import { NotificationDeliveryType } from '../notifications/notifications.types';
import { AuthentikParser } from './builtin/authentik.parser';
import { BuiltinParserService } from './builtin/builtin-parser.service';
import { PayloadMapperService } from './payload-mapper.service';

describe('PayloadMapperService', () => {
  let service: PayloadMapperService;
  let payloadMapperRepository: Repository<PayloadMapper>;
  let builtinParserService: BuiltinParserService;

  const mockPayloadMapper: Partial<PayloadMapper> = {
    id: 'mapper-1',
    name: 'Test Mapper',
    jsEvalFn: 'return { title: "Test" };',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayloadMapperService,
        {
          provide: getRepositoryToken(PayloadMapper),
          useValue: {
            find: jest.fn().mockResolvedValue([mockPayloadMapper]),
            findOne: jest.fn().mockResolvedValue(mockPayloadMapper),
            create: jest.fn().mockReturnValue(mockPayloadMapper),
            save: jest.fn().mockResolvedValue(mockPayloadMapper),
            remove: jest.fn().mockResolvedValue(mockPayloadMapper),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: BuiltinParserService,
          useValue: {
            hasParser: jest.fn().mockReturnValue(true),
            transformPayload: jest.fn().mockReturnValue({
              title: 'Test Title',
              subtitle: 'Test Subtitle',
              body: 'Test Body',
              deliveryType: 'NORMAL',
              bucketId: '',
            }),
            getAllParsers: jest.fn().mockReturnValue([
              {
                name: 'authentik',
                type: 'ZENTIK_AUTHENTIK',
                description: 'Authentik authentication events parser',
              },
            ]),
          },
        },
        AuthentikParser,
      ],
    }).compile();

    service = module.get<PayloadMapperService>(PayloadMapperService);
    payloadMapperRepository = module.get<Repository<PayloadMapper>>(
      getRepositoryToken(PayloadMapper),
    );
    builtinParserService = module.get<BuiltinParserService>(BuiltinParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return user mappers and builtin parsers', async () => {
      const result = await service.findAll('user-1');

      expect(payloadMapperRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        relations: ['user'],
        order: { createdAt: 'DESC' },
      });

      expect(builtinParserService.getAllParsers).toHaveBeenCalled();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockPayloadMapper);
      expect(result[1]).toEqual({
        id: 'builtin-zentik_authentik',
        builtInName: 'ZENTIK_AUTHENTIK',
        name: 'authentik',
        jsEvalFn: '',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('findOne', () => {
    it('should return a payload mapper by id', async () => {
      const result = await service.findOne('mapper-1', 'user-1');

      expect(payloadMapperRepository.findOne).toHaveBeenCalledWith({
        where: [{ id: 'mapper-1', userId: 'user-1' }],
        relations: ['user'],
      });
      expect(result).toEqual(mockPayloadMapper);
    });
  });

  describe('create', () => {
    it('should create a new payload mapper', async () => {
      const createDto = {
        name: 'New Mapper',
        jsEvalFn: 'return { title: "New" };',
      };

      const result = await service.create('user-1', createDto);

      expect(payloadMapperRepository.create).toHaveBeenCalledWith({
        ...createDto,
        userId: 'user-1',
        user: { id: 'user-1' },
      });
      expect(payloadMapperRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockPayloadMapper);
    });
  });

  describe('update', () => {
    it('should update an existing payload mapper', async () => {
      const updateDto = {
        name: 'Updated Mapper',
        jsEvalFn: 'return { title: "Updated" };',
      };

      const result = await service.update('mapper-1', 'user-1', updateDto);

      expect(payloadMapperRepository.findOne).toHaveBeenCalledWith({
        where: [{ id: 'mapper-1', userId: 'user-1' }],
        relations: ['user'],
      });
      expect(payloadMapperRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockPayloadMapper);
    });
  });

  describe('remove', () => {
    it('should remove a payload mapper', async () => {
      const result = await service.remove('mapper-1', 'user-1');

      expect(payloadMapperRepository.findOne).toHaveBeenCalledWith({
        where: [{ id: 'mapper-1', userId: 'user-1' }],
        relations: ['user'],
      });
      expect(payloadMapperRepository.remove).toHaveBeenCalledWith(mockPayloadMapper);
      expect(result).toBeUndefined();
    });
  });

  describe('transformPayload', () => {
    const mockPayload = {
      user_email: 'test@example.com',
      user_username: 'testuser',
      body: 'User testuser logged in successfully',
    };

    it('should transform payload using builtin parser', async () => {
      const result = await service.transformPayload('authentik', mockPayload, 'user-1', 'bucket-1');

      expect(builtinParserService.hasParser).toHaveBeenCalledWith('authentik');
      expect(builtinParserService.transformPayload).toHaveBeenCalledWith('authentik', mockPayload);

      expect(result).toEqual({
        title: 'Test Title',
        subtitle: 'Test Subtitle',
        body: 'Test Body',
        sound: undefined,
        deliveryType: NotificationDeliveryType.NORMAL,
        bucketId: 'bucket-1',
      });
    });

    it('should throw NotFoundException for unknown parser', async () => {
      jest.spyOn(builtinParserService, 'hasParser').mockReturnValue(false);

      await expect(
        service.transformPayload('unknown', mockPayload, 'user-1', 'bucket-1'),
      ).rejects.toThrow("Parser 'unknown' not found. Builtin parsers are available via /messages/parsers endpoint.");
    });
  });
});
