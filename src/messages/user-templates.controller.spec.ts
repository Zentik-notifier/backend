import { Test, TestingModule } from '@nestjs/testing';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { UserTemplate } from '../entities/user-template.entity';
import { CreateUserTemplateDto, UpdateUserTemplateDto } from './dto';
import { UserTemplatesController } from './user-templates.controller';
import { UserTemplatesService } from './user-templates.service';

describe('UserTemplatesController', () => {
  let controller: UserTemplatesController;
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
      controllers: [UserTemplatesController],
      providers: [
        {
          provide: UserTemplatesService,
          useValue: mockUserTemplatesService,
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<UserTemplatesController>(
      UserTemplatesController,
    );
    userTemplatesService = module.get<UserTemplatesService>(
      UserTemplatesService,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user template', async () => {
      const createDto: CreateUserTemplateDto = {
        name: 'New Template',
        description: 'New Description',
        title: 'Hello {{name}}!',
        body: 'Body {{name}}!',
        subtitle: 'Subtitle {{name}}!',
      };

      mockUserTemplatesService.create.mockResolvedValue(mockUserTemplate);

      const result = await controller.create('user-1', createDto);

      expect(result).toEqual(mockUserTemplate);
      expect(userTemplatesService.create).toHaveBeenCalledWith(
        'user-1',
        createDto,
      );
    });
  });

  describe('findAll', () => {
    it('should return all user templates', async () => {
      const templates = [mockUserTemplate];
      mockUserTemplatesService.findAll.mockResolvedValue(templates);

      const result = await controller.findAll('user-1');

      expect(result).toEqual(templates);
      expect(userTemplatesService.findAll).toHaveBeenCalledWith('user-1');
    });
  });

  describe('findOne', () => {
    it('should return a user template by id', async () => {
      mockUserTemplatesService.findOne.mockResolvedValue(mockUserTemplate);

      const result = await controller.findOne('template-1', 'user-1');

      expect(result).toEqual(mockUserTemplate);
      expect(userTemplatesService.findOne).toHaveBeenCalledWith(
        'template-1',
        'user-1',
      );
    });
  });

  describe('update', () => {
    it('should update a user template', async () => {
      const updateDto: UpdateUserTemplateDto = {
        name: 'Updated Template',
      };

      const updatedTemplate = {
        ...mockUserTemplate,
        ...updateDto,
      };

      mockUserTemplatesService.update.mockResolvedValue(updatedTemplate);

      const result = await controller.update('template-1', 'user-1', updateDto);

      expect(result).toEqual(updatedTemplate);
      expect(userTemplatesService.update).toHaveBeenCalledWith(
        'template-1',
        'user-1',
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove a user template', async () => {
      mockUserTemplatesService.remove.mockResolvedValue(true);

      const result = await controller.remove('template-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(userTemplatesService.remove).toHaveBeenCalledWith(
        'template-1',
        'user-1',
      );
    });
  });
});
