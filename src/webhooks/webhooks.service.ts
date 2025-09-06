import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';
import { Repository } from 'typeorm';
import { UserWebhook } from '../entities';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(UserWebhook)
    private readonly webhookRepository: Repository<UserWebhook>,
    private readonly entityPermissionService: EntityPermissionService,
  ) {}

  async createWebhook(
    userId: string,
    input: CreateWebhookDto,
  ): Promise<UserWebhook> {
    const webhook = this.webhookRepository.create({
      ...input,
      user: { id: userId },
    });

    const savedWebhook = await this.webhookRepository.save(webhook);

    // Return the webhook with user relation populated
    const webhookWithUser = await this.webhookRepository.findOne({
      where: { id: savedWebhook.id },
      relations: ['user'],
    });

    if (!webhookWithUser) {
      throw new Error('Failed to create webhook');
    }

    return webhookWithUser;
  }

  async getUserWebhooks(userId: string): Promise<UserWebhook[]> {
    // Get owned webhooks
    const ownedWebhooks = await this.webhookRepository.find({
      where: { user: { id: userId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    // Get shared webhooks through entity permissions
    const sharedWebhooks = await this.webhookRepository
      .createQueryBuilder('webhook')
      .leftJoinAndSelect('webhook.user', 'user')
      .innerJoin(
        'entity_permissions',
        'ep',
        'ep.resourceType = :resourceType AND ep.resourceId = webhook.id AND ep.userId = :userId',
        { resourceType: ResourceType.USER_WEBHOOK, userId },
      )
      .where('webhook.user.id != :userId', { userId })
      .orderBy('webhook.createdAt', 'DESC')
      .getMany();

    // Combine and remove duplicates
    const allWebhooks = [...ownedWebhooks, ...sharedWebhooks];
    const uniqueWebhooks = allWebhooks.filter(
      (webhook, index, self) =>
        index === self.findIndex((w) => w.id === webhook.id),
    );

    return uniqueWebhooks.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getWebhookById(id: string, userId: string): Promise<UserWebhook> {
    const webhook = await this.webhookRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Check if user owns the webhook or has read permissions
    const isOwner = webhook.user.id === userId;
    if (!isOwner) {
      const hasPermission = await this.entityPermissionService.hasPermissions(
        userId,
        ResourceType.USER_WEBHOOK,
        id,
        [Permission.READ],
      );

      if (!hasPermission) {
        throw new ForbiddenException('You do not have access to this webhook');
      }
    }

    return webhook;
  }

  async updateWebhook(
    id: string,
    userId: string,
    input: UpdateWebhookDto,
  ): Promise<UserWebhook> {
    const webhook = await this.webhookRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Check if user owns the webhook or has write permissions
    const isOwner = webhook.user.id === userId;
    if (!isOwner) {
      const hasPermission = await this.entityPermissionService.hasPermissions(
        userId,
        ResourceType.USER_WEBHOOK,
        id,
        [Permission.WRITE],
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'You do not have write access to this webhook',
        );
      }
    }

    Object.assign(webhook, input);
    const updatedWebhook = await this.webhookRepository.save(webhook);

    // Return the updated webhook with user relation populated
    const webhookWithUser = await this.webhookRepository.findOne({
      where: { id: updatedWebhook.id },
      relations: ['user'],
    });

    if (!webhookWithUser) {
      throw new Error('Failed to update webhook');
    }

    return webhookWithUser;
  }

  async deleteWebhook(id: string, userId: string): Promise<boolean> {
    const webhook = await this.webhookRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Check if user owns the webhook or has delete permissions
    const isOwner = webhook.user.id === userId;
    if (!isOwner) {
      const hasPermission = await this.entityPermissionService.hasPermissions(
        userId,
        ResourceType.USER_WEBHOOK,
        id,
        [Permission.DELETE],
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'You do not have delete access to this webhook',
        );
      }
    }

    await this.webhookRepository.remove(webhook);
    return true;
  }

  async executeWebhook(webhook: UserWebhook, payload: any): Promise<void> {
    // TODO: Implement webhook execution logic
    console.log(`Executing webhook ${webhook.name} to ${webhook.url}`, payload);

    // Basic HTTP client implementation would go here
    // For now, just log the webhook execution
  }
}
