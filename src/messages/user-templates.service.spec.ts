import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTemplate } from '../entities/user-template.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../users/users.types';
import { CreateUserTemplateDto, UpdateUserTemplateDto } from './dto';
import { UserTemplatesService } from './user-templates.service';

describe('UserTemplatesService', () => {
  let service: UserTemplatesService;
  let userTemplateRepository: Repository<UserTemplate>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedpassword',
    hasPassword: true,
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
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
  };

  const mockUserTemplate: UserTemplate = {
    id: 'template-1',
    name: 'Test Template',
    description: 'Test Description',
    title: 'Hello {{user}}!',
    subtitle: 'Subtitle {{user}}!',
    body: 'Body content {{user}}!',
    userId: 'user-1',
    user: mockUser,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserTemplateRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTemplatesService,
        {
          provide: getRepositoryToken(UserTemplate),
          useValue: mockUserTemplateRepository,
        },
      ],
    }).compile();

    service = module.get<UserTemplatesService>(UserTemplatesService);
    userTemplateRepository = module.get<Repository<UserTemplate>>(
      getRepositoryToken(UserTemplate),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateUserTemplateDto = {
      name: 'New Template',
      description: 'New Description',
      title: 'Hello {{name}}!',
      subtitle: 'Subtitle {{name}}!',
      body: 'Body {{name}}!',
    };

    it('should create a user template', async () => {
      const createdTemplate = {
        ...mockUserTemplate,
        ...createDto,
        id: 'template-2',
      };

      mockUserTemplateRepository.create.mockReturnValue(createdTemplate);
      mockUserTemplateRepository.save.mockResolvedValue(createdTemplate);
      mockUserTemplateRepository.findOne.mockResolvedValue({
        ...createdTemplate,
        user: mockUser,
      });

      const result = await service.create('user-1', createDto);

      expect(mockUserTemplateRepository.create).toHaveBeenCalledWith({
        ...createDto,
        user: { id: 'user-1' },
      });
      expect(mockUserTemplateRepository.save).toHaveBeenCalled();
      expect(mockUserTemplateRepository.findOne).toHaveBeenCalledWith({
        where: { id: createdTemplate.id },
        relations: ['user'],
      });
      expect(result).toEqual({
        ...createdTemplate,
        user: mockUser,
      });
    });
  });

  describe('findAll', () => {
    it('should return all user templates for a user', async () => {
      const templates = [
        { ...mockUserTemplate, id: 'template-1' },
        { ...mockUserTemplate, id: 'template-2', name: 'Template 2' },
      ];

      mockUserTemplateRepository.find.mockResolvedValue(
        templates.map((t) => ({ ...t, user: mockUser })),
      );

      const result = await service.findAll('user-1');

      expect(mockUserTemplateRepository.find).toHaveBeenCalledWith({
        where: { user: { id: 'user-1' } },
        relations: ['user'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].user).toEqual(mockUser);
    });

    it('should return empty array if user has no templates', async () => {
      mockUserTemplateRepository.find.mockResolvedValue([]);

      const result = await service.findAll('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a user template by id', async () => {
      mockUserTemplateRepository.findOne.mockResolvedValue({
        ...mockUserTemplate,
        user: mockUser,
      });

      const result = await service.findOne('template-1', 'user-1');

      expect(mockUserTemplateRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        relations: ['user'],
      });
      expect(result).toEqual({
        ...mockUserTemplate,
        user: mockUser,
      });
    });

    it('should throw NotFoundException if template not found', async () => {
      mockUserTemplateRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('template-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own the template', async () => {
      const otherUserTemplate = {
        ...mockUserTemplate,
        userId: 'user-2',
        user: { ...mockUser, id: 'user-2' },
      };

      mockUserTemplateRepository.findOne.mockResolvedValue(otherUserTemplate);

      await expect(service.findOne('template-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserTemplateDto = {
      name: 'Updated Template',
      description: 'Updated Description',
    };

    it('should update a user template', async () => {
      const existingTemplate = {
        ...mockUserTemplate,
        user: mockUser,
      };

      const updatedTemplate = {
        ...existingTemplate,
        ...updateDto,
      };

      mockUserTemplateRepository.findOne
        .mockResolvedValueOnce(existingTemplate)
        .mockResolvedValueOnce({
          ...updatedTemplate,
          user: mockUser,
        });
      mockUserTemplateRepository.save.mockResolvedValue(updatedTemplate);

      const result = await service.update('template-1', 'user-1', updateDto);

      expect(mockUserTemplateRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockUserTemplateRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updateDto),
      );
      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
    });

    it('should throw NotFoundException if template not found', async () => {
      mockUserTemplateRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('template-1', 'user-1', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the template', async () => {
      const otherUserTemplate = {
        ...mockUserTemplate,
        userId: 'user-2',
        user: { ...mockUser, id: 'user-2' },
      };

      mockUserTemplateRepository.findOne.mockResolvedValue(otherUserTemplate);

      await expect(
        service.update('template-1', 'user-1', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should remove a user template', async () => {
      mockUserTemplateRepository.findOne.mockResolvedValue({
        ...mockUserTemplate,
        user: mockUser,
      });
      mockUserTemplateRepository.remove.mockResolvedValue(mockUserTemplate);

      const result = await service.remove('template-1', 'user-1');

      expect(mockUserTemplateRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        relations: ['user'],
      });
      expect(mockUserTemplateRepository.remove).toHaveBeenCalledWith(
        mockUserTemplate,
      );
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if template not found', async () => {
      mockUserTemplateRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('template-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own the template', async () => {
      const otherUserTemplate = {
        ...mockUserTemplate,
        userId: 'user-2',
        user: { ...mockUser, id: 'user-2' },
      };

      mockUserTemplateRepository.findOne.mockResolvedValue(otherUserTemplate);

      await expect(service.remove('template-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
