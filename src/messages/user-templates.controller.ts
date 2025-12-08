import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { UserTemplate } from '../entities/user-template.entity';
import {
  CreateUserTemplateDto,
  UpdateUserTemplateDto,
} from './dto';
import { UserTemplatesService } from './user-templates.service';

@ApiTags('User Templates')
@Controller('user-templates')
@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
export class UserTemplatesController {
  constructor(
    private readonly userTemplatesService: UserTemplatesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user template' })
  @ApiResponse({
    status: 201,
    description: 'User template created successfully',
    type: UserTemplate,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async create(
    @GetUser('id') userId: string,
    @Body() input: CreateUserTemplateDto,
  ): Promise<UserTemplate> {
    return this.userTemplatesService.create(userId, input);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user templates for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of user templates',
    type: [UserTemplate],
  })
  async findAll(@GetUser('id') userId: string): Promise<UserTemplate[]> {
    return this.userTemplatesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user template by ID' })
  @ApiParam({ name: 'id', description: 'User template ID' })
  @ApiResponse({
    status: 200,
    description: 'User template details',
    type: UserTemplate,
  })
  @ApiResponse({ status: 404, description: 'User template not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<UserTemplate> {
    return this.userTemplatesService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user template by ID' })
  @ApiParam({ name: 'id', description: 'User template ID' })
  @ApiResponse({
    status: 200,
    description: 'User template updated successfully',
    type: UserTemplate,
  })
  @ApiResponse({ status: 404, description: 'User template not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async update(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() input: UpdateUserTemplateDto,
  ): Promise<UserTemplate> {
    return this.userTemplatesService.update(id, userId, input);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user template by ID' })
  @ApiParam({ name: 'id', description: 'User template ID' })
  @ApiResponse({
    status: 200,
    description: 'User template deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'User template not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async remove(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<{ success: boolean }> {
    await this.userTemplatesService.remove(id, userId);
    return { success: true };
  }
}
