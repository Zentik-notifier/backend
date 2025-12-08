import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTemplate } from '../entities/user-template.entity';
import { CreateUserTemplateDto, UpdateUserTemplateDto } from './dto';

@Injectable()
export class UserTemplatesService {
  constructor(
    @InjectRepository(UserTemplate)
    private readonly userTemplateRepository: Repository<UserTemplate>,
  ) {}

  async create(
    userId: string,
    input: CreateUserTemplateDto,
  ): Promise<UserTemplate> {
    const template = this.userTemplateRepository.create({
      ...input,
      user: { id: userId },
    });

    const savedTemplate = await this.userTemplateRepository.save(template);

    const templateWithUser = await this.userTemplateRepository.findOne({
      where: { id: savedTemplate.id },
      relations: ['user'],
    });

    if (!templateWithUser) {
      throw new Error('Failed to create user template');
    }

    return templateWithUser;
  }

  async findAll(userId: string): Promise<UserTemplate[]> {
    return this.userTemplateRepository.find({
      where: { user: { id: userId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<UserTemplate> {
    const template = await this.userTemplateRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!template) {
      throw new NotFoundException('User template not found');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this user template',
      );
    }

    return template;
  }

  async update(
    id: string,
    userId: string,
    input: UpdateUserTemplateDto,
  ): Promise<UserTemplate> {
    const template = await this.userTemplateRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!template) {
      throw new NotFoundException('User template not found');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this user template',
      );
    }

    Object.assign(template, input);
    const updatedTemplate = await this.userTemplateRepository.save(template);

    const templateWithUser = await this.userTemplateRepository.findOne({
      where: { id: updatedTemplate.id },
      relations: ['user'],
    });

    if (!templateWithUser) {
      throw new Error('Failed to update user template');
    }

    return templateWithUser;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const template = await this.userTemplateRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!template) {
      throw new NotFoundException('User template not found');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this user template',
      );
    }

    await this.userTemplateRepository.remove(template);
    return true;
  }

  async findByUserIdAndNameOrId(
    userId: string,
    nameOrId: string,
  ): Promise<UserTemplate | null> {
    // Try to find by ID first (if it's a valid UUID format)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      nameOrId,
    );

    if (isUuid) {
      const template = await this.userTemplateRepository.findOne({
        where: { id: nameOrId, user: { id: userId } },
        relations: ['user'],
      });
      if (template) {
        return template;
      }
    }

    // Try to find by name
    const template = await this.userTemplateRepository.findOne({
      where: { name: nameOrId, user: { id: userId } },
      relations: ['user'],
    });

    return template;
  }
}
