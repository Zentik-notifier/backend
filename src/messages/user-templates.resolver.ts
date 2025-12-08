import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { UserTemplate } from '../entities/user-template.entity';
import {
  CreateUserTemplateDto,
  UpdateUserTemplateDto,
} from './dto';
import { UserTemplatesService } from './user-templates.service';

@Resolver(() => UserTemplate)
@UseGuards(JwtOrAccessTokenGuard)
export class UserTemplatesResolver {
  constructor(
    private readonly userTemplatesService: UserTemplatesService,
  ) {}

  @Query(() => [UserTemplate], {
    description: 'Get all user templates for the authenticated user',
  })
  async userTemplates(
    @GetUser('id') userId: string,
  ): Promise<UserTemplate[]> {
    return this.userTemplatesService.findAll(userId);
  }

  @Query(() => UserTemplate, {
    description: 'Get user template by ID',
  })
  async userTemplate(
    @Args('id', { type: () => ID }) id: string,
    @GetUser('id') userId: string,
  ): Promise<UserTemplate> {
    return this.userTemplatesService.findOne(id, userId);
  }

  @Mutation(() => UserTemplate, {
    description: 'Create a new user template',
  })
  async createUserTemplate(
    @Args('input') input: CreateUserTemplateDto,
    @GetUser('id') userId: string,
  ): Promise<UserTemplate> {
    return this.userTemplatesService.create(userId, input);
  }

  @Mutation(() => UserTemplate, {
    description: 'Update user template by ID',
  })
  async updateUserTemplate(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserTemplateDto,
    @GetUser('id') userId: string,
  ): Promise<UserTemplate> {
    return this.userTemplatesService.update(id, userId, input);
  }

  @Mutation(() => Boolean, {
    description: 'Delete user template by ID',
  })
  async deleteUserTemplate(
    @Args('id', { type: () => ID }) id: string,
    @GetUser('id') userId: string,
  ): Promise<boolean> {
    return this.userTemplatesService.remove(id, userId);
  }
}
