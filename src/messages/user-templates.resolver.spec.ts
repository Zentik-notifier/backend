import { Test, TestingModule } from '@nestjs/testing';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { UserTemplate } from '../entities/user-template.entity';
import { CreateUserTemplateDto, UpdateUserTemplateDto } from './dto';
import { UserTemplatesResolver } from './user-templates.resolver';
import { UserTemplatesService } from './user-templates.service';

describe('UserTemplatesResolver', () => {
  let resolver: UserTemplatesResolver;
  let userTemplatesService: UserTemplatesService;

  const mockUserTemplate: UserTemplate = {
    id: 'template-1',
    name: 'Test Template',
    description: 'Test Description',
    title: 'Hello {{user}}!',
    body: 'Body content {{user}}!',
    subtitle: 'Subtitle content {{user}}!',
    userId: 'user-1',
    user: {} as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserTemplatesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTemplatesResolver,
        {
          provide: UserTemplatesService,
          useValue: mockUserTemplatesService,
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    resolver = module.get<UserTemplatesResolver>(UserTemplatesResolver);
    userTemplatesService = module.get<UserTemplatesService>(
      UserTemplatesService,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('userTemplates', () => {
    it('should return all user templates', async () => {
      const templates = [mockUserTemplate];
      mockUserTemplatesService.findAll.mockResolvedValue(templates);

      const result = await resolver.userTemplates('user-1');

      expect(result).toEqual(templates);
      expect(userTemplatesService.findAll).toHaveBeenCalledWith('user-1');
    });
  });

  describe('userTemplate', () => {
    it('should return a user template by id', async () => {
      mockUserTemplatesService.findOne.mockResolvedValue(mockUserTemplate);

      const result = await resolver.userTemplate('template-1', 'user-1');

      expect(result).toEqual(mockUserTemplate);
      expect(userTemplatesService.findOne).toHaveBeenCalledWith(
        'template-1',
        'user-1',
      );
    });
  });

  describe('createUserTemplate', () => {
    it('should create a user template', async () => {
      const createDto: CreateUserTemplateDto = {
        name: 'New Template',
        description: 'New Description',
        title: 'Hello {{name}}!',
        body: 'Body {{name}}!',
        subtitle: 'Subtitle {{name}}!',
      };

      mockUserTemplatesService.create.mockResolvedValue(mockUserTemplate);

      const result = await resolver.createUserTemplate(createDto, 'user-1');

      expect(result).toEqual(mockUserTemplate);
      expect(userTemplatesService.create).toHaveBeenCalledWith(
        'user-1',
        createDto,
      );
    });
  });

  describe('updateUserTemplate', () => {
    it('should update a user template', async () => {
      const updateDto: UpdateUserTemplateDto = {
        name: 'Updated Template',
      };

      const updatedTemplate = {
        ...mockUserTemplate,
        ...updateDto,
      };

      mockUserTemplatesService.update.mockResolvedValue(updatedTemplate);

      const result = await resolver.updateUserTemplate(
        'template-1',
        updateDto,
        'user-1',
      );

      expect(result).toEqual(updatedTemplate);
      expect(userTemplatesService.update).toHaveBeenCalledWith(
        'template-1',
        'user-1',
        updateDto,
      );
    });
  });

  describe('deleteUserTemplate', () => {
    it('should delete a user template', async () => {
      mockUserTemplatesService.remove.mockResolvedValue(true);

      const result = await resolver.deleteUserTemplate('template-1', 'user-1');

      expect(result).toBe(true);
      expect(userTemplatesService.remove).toHaveBeenCalledWith(
        'template-1',
        'user-1',
      );
    });
  });
});
