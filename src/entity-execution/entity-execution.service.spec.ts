import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EntityExecution,
  ExecutionType,
  ExecutionStatus,
  User,
} from '../entities';
import { EntityExecutionService } from './entity-execution.service';

describe('EntityExecutionService', () => {
  let service: EntityExecutionService;
  let repository: Repository<EntityExecution>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedpassword',
    hasPassword: true,
    firstName: 'Test',
    lastName: 'User',
    role: 'USER' as any,
    emailConfirmed: true,
    emailConfirmationToken: null,
    emailConfirmationTokenRequestedAt: null,
    resetToken: null,
    resetTokenRequestedAt: null,
    avatar: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    buckets: [],
    userBuckets: [],
    devices: [],
    sessions: [],
    accessTokens: [],
    identities: [],
    webhooks: [],
    templates: [],
    externalNotifySystems: [],
  };

  const mockEntityExecutionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const mockEntityExecution: EntityExecution = {
    id: 'execution-1',
    type: ExecutionType.PAYLOAD_MAPPER,
    status: ExecutionStatus.SUCCESS,
    entityName: 'Test Parser',
    entityId: 'parser-1',
    userId: 'user-1',
    user: mockUser,
    input: '{"test": "data"}',
    output: '{"result": "success"}',
    errors: undefined,
    durationMs: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityExecutionService,
        {
          provide: getRepositoryToken(EntityExecution),
          useValue: mockEntityExecutionRepository,
        },
      ],
    }).compile();

    service = module.get<EntityExecutionService>(EntityExecutionService);
    repository = module.get<Repository<EntityExecution>>(
      getRepositoryToken(EntityExecution),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new entity execution', async () => {
      const executionData = {
        type: ExecutionType.PAYLOAD_MAPPER,
        status: ExecutionStatus.SUCCESS,
        entityName: 'Test Parser',
        entityId: 'parser-1',
        userId: 'user-1',
        input: '{"test": "data"}',
        output: '{"result": "success"}',
        durationMs: 100,
      };

      mockEntityExecutionRepository.create.mockReturnValue(mockEntityExecution);
      mockEntityExecutionRepository.save.mockResolvedValue(mockEntityExecution);

      const result = await service.create(executionData);

      expect(mockEntityExecutionRepository.create).toHaveBeenCalledWith({
        type: executionData.type,
        status: executionData.status,
        entityName: executionData.entityName,
        entityId: executionData.entityId,
        userId: executionData.userId,
        input: executionData.input,
        output: executionData.output,
        errors: undefined,
        durationMs: executionData.durationMs,
      });

      expect(mockEntityExecutionRepository.save).toHaveBeenCalledWith(
        mockEntityExecution,
      );
      expect(result).toEqual(mockEntityExecution);
    });

    it('should create execution with error status and errors', async () => {
      const executionData = {
        type: ExecutionType.WEBHOOK,
        status: ExecutionStatus.ERROR,
        entityName: 'Test Webhook',
        userId: 'user-1',
        input: '{"webhook": "data"}',
        errors: 'Connection timeout',
        durationMs: 5000,
      };

      mockEntityExecutionRepository.create.mockReturnValue(mockEntityExecution);
      mockEntityExecutionRepository.save.mockResolvedValue(mockEntityExecution);

      const result = await service.create(executionData);

      expect(mockEntityExecutionRepository.create).toHaveBeenCalledWith({
        type: executionData.type,
        status: executionData.status,
        entityName: executionData.entityName,
        entityId: undefined,
        userId: executionData.userId,
        input: executionData.input,
        output: undefined,
        errors: executionData.errors,
        durationMs: executionData.durationMs,
      });

      expect(result).toEqual(mockEntityExecution);
    });
  });

  describe('findByUserId', () => {
    it('should find executions by user ID', async () => {
      const executions = [mockEntityExecution];
      mockEntityExecutionRepository.find.mockResolvedValue(executions);

      const result = await service.findByUserId('user-1');

      expect(mockEntityExecutionRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(executions);
    });
  });

  describe('findByType', () => {
    it('should find executions by type only', async () => {
      const executions = [mockEntityExecution];
      mockEntityExecutionRepository.find.mockResolvedValue(executions);

      const result = await service.findByType(ExecutionType.PAYLOAD_MAPPER);

      expect(mockEntityExecutionRepository.find).toHaveBeenCalledWith({
        where: { type: ExecutionType.PAYLOAD_MAPPER },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(executions);
    });

    it('should find executions by type and user ID', async () => {
      const executions = [mockEntityExecution];
      mockEntityExecutionRepository.find.mockResolvedValue(executions);

      const result = await service.findByType(
        ExecutionType.PAYLOAD_MAPPER,
        'user-1',
      );

      expect(mockEntityExecutionRepository.find).toHaveBeenCalledWith({
        where: { type: ExecutionType.PAYLOAD_MAPPER, userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(executions);
    });
  });

  describe('findByStatus', () => {
    it('should find executions by status only', async () => {
      const executions = [mockEntityExecution];
      mockEntityExecutionRepository.find.mockResolvedValue(executions);

      const result = await service.findByStatus(ExecutionStatus.SUCCESS);

      expect(mockEntityExecutionRepository.find).toHaveBeenCalledWith({
        where: { status: ExecutionStatus.SUCCESS },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(executions);
    });

    it('should find executions by status and user ID', async () => {
      const executions = [mockEntityExecution];
      mockEntityExecutionRepository.find.mockResolvedValue(executions);

      const result = await service.findByStatus(
        ExecutionStatus.SUCCESS,
        'user-1',
      );

      expect(mockEntityExecutionRepository.find).toHaveBeenCalledWith({
        where: { status: ExecutionStatus.SUCCESS, userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(executions);
    });
  });

  describe('findByTypeAndEntity', () => {
    it('should find executions by type only', async () => {
      const executions = [mockEntityExecution];
      mockEntityExecutionRepository.find.mockResolvedValue(executions);

      const result = await service.findByTypeAndEntity(
        ExecutionType.PAYLOAD_MAPPER,
      );

      expect(mockEntityExecutionRepository.find).toHaveBeenCalledWith({
        where: { type: ExecutionType.PAYLOAD_MAPPER },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(executions);
    });

    it('should find executions by type and entity ID', async () => {
      const executions = [mockEntityExecution];
      mockEntityExecutionRepository.find.mockResolvedValue(executions);

      const result = await service.findByTypeAndEntity(
        ExecutionType.PAYLOAD_MAPPER,
        'parser-1',
      );

      expect(mockEntityExecutionRepository.find).toHaveBeenCalledWith({
        where: { type: ExecutionType.PAYLOAD_MAPPER, entityId: 'parser-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(executions);
    });

    it('should find executions by type, entity ID and user ID', async () => {
      const executions = [mockEntityExecution];
      mockEntityExecutionRepository.find.mockResolvedValue(executions);

      const result = await service.findByTypeAndEntity(
        ExecutionType.PAYLOAD_MAPPER,
        'parser-1',
        undefined,
        'user-1',
      );

      expect(mockEntityExecutionRepository.find).toHaveBeenCalledWith({
        where: {
          type: ExecutionType.PAYLOAD_MAPPER,
          entityId: 'parser-1',
          userId: 'user-1',
        },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(executions);
    });
  });

  describe('findOne', () => {
    it('should find one execution by ID only', async () => {
      mockEntityExecutionRepository.findOne.mockResolvedValue(
        mockEntityExecution,
      );

      const result = await service.findOne('execution-1');

      expect(mockEntityExecutionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'execution-1' },
      });
      expect(result).toEqual(mockEntityExecution);
    });

    it('should find one execution by ID and user ID', async () => {
      mockEntityExecutionRepository.findOne.mockResolvedValue(
        mockEntityExecution,
      );

      const result = await service.findOne('execution-1', 'user-1');

      expect(mockEntityExecutionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'execution-1', userId: 'user-1' },
      });
      expect(result).toEqual(mockEntityExecution);
    });

    it('should return null when execution not found', async () => {
      mockEntityExecutionRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete executions older than specified days', async () => {
      const mockResult = { affected: 5 };
      mockEntityExecutionRepository.execute.mockResolvedValue(mockResult);

      const result = await service.deleteOlderThan(30);

      expect(
        mockEntityExecutionRepository.createQueryBuilder,
      ).toHaveBeenCalled();
      expect(mockEntityExecutionRepository.from).toHaveBeenCalledWith(
        EntityExecution,
      );
      expect(mockEntityExecutionRepository.where).toHaveBeenCalledWith(
        'createdAt < :cutoffDate',
        expect.any(Object),
      );
      expect(mockEntityExecutionRepository.execute).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should return 0 when no executions are deleted', async () => {
      const mockResult = { affected: 0 };
      mockEntityExecutionRepository.execute.mockResolvedValue(mockResult);

      const result = await service.deleteOlderThan(7);

      expect(result).toBe(0);
    });
  });

  describe('getUserStats', () => {
    it('should return user execution statistics', async () => {
      const executions = [
        {
          ...mockEntityExecution,
          type: ExecutionType.PAYLOAD_MAPPER,
          status: ExecutionStatus.SUCCESS,
        },
        {
          ...mockEntityExecution,
          id: 'execution-2',
          type: ExecutionType.PAYLOAD_MAPPER,
          status: ExecutionStatus.ERROR,
        },
        {
          ...mockEntityExecution,
          id: 'execution-3',
          type: ExecutionType.WEBHOOK,
          status: ExecutionStatus.SUCCESS,
        },
      ];

      mockEntityExecutionRepository.find.mockResolvedValue(executions);

      const result = await service.getUserStats('user-1');

      expect(mockEntityExecutionRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      expect(result).toEqual({
        total: 3,
        byType: {
          [ExecutionType.PAYLOAD_MAPPER]: 2,
          [ExecutionType.WEBHOOK]: 1,
        },
        byStatus: {
          [ExecutionStatus.SUCCESS]: 2,
          [ExecutionStatus.ERROR]: 1,
        },
        recentExecutions: executions.slice(0, 3),
      });
    });

    it('should handle empty executions list', async () => {
      mockEntityExecutionRepository.find.mockResolvedValue([]);

      const result = await service.getUserStats('user-1');

      expect(result).toEqual({
        total: 0,
        byType: {},
        byStatus: {},
        recentExecutions: [],
      });
    });
  });
});
