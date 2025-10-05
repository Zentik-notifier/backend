import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';
import { Repository } from 'typeorm';
import { UserWebhook } from '../entities';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { EntityExecutionService } from '../entity-execution/entity-execution.service';
import { ExecutionType, ExecutionStatus } from '../entities';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(UserWebhook)
    private readonly webhookRepository: Repository<UserWebhook>,
    private readonly entityPermissionService: EntityPermissionService,
    private readonly entityExecutionService: EntityExecutionService,
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

  async executeWebhook(webhookId: string, userId: string): Promise<void> {
    // Fetch the webhook entity from database
    const webhook = await this.getWebhookById(webhookId, userId);

    this.logger.log(`Executing webhook ${webhook.name} to ${webhook.url}`);

    const startTime = Date.now();
    let executionStatus: ExecutionStatus = ExecutionStatus.SUCCESS;
    let executionErrors: string | undefined;
    let responseBody: string | undefined;

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Zentik-Webhook/1.0',
      };

      // Add custom headers from webhook configuration
      if (webhook.headers && webhook.headers.length > 0) {
        webhook.headers.forEach((header) => {
          headers[header.key] = header.value;
        });
      }

      // Prepare request options
      const requestOptions: RequestInit = {
        method: webhook.method,
        headers,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      };

      // Add body for POST, PUT, PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(webhook.method)) {
        if (webhook.body) {
          // Use webhook's configured body with timestamp
          const requestBody = {
            ...webhook.body,
            timestamp: new Date().toISOString(),
          };
          requestOptions.body = JSON.stringify(requestBody);
        } else {
          // Default: send minimal payload with timestamp
          requestOptions.body = JSON.stringify({
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Execute the webhook
      const response = await fetch(webhook.url, requestOptions);

      if (response.ok) {
        this.logger.log(
          `Webhook ${webhook.name} executed successfully. Status: ${response.status}`,
        );
        responseBody = await response.text();
      } else {
        const errorText = await response.text();
        executionStatus = ExecutionStatus.ERROR;
        executionErrors = `HTTP ${response.status}: ${errorText}`;
        this.logger.error(
          `Webhook ${webhook.name} failed. Status: ${response.status}, Response: ${errorText}`,
        );
      }
    } catch (error) {
      executionStatus =
        error.name === 'AbortError'
          ? ExecutionStatus.TIMEOUT
          : ExecutionStatus.ERROR;
      executionErrors = error.message;
      if (error.name === 'AbortError') {
        this.logger.error(`Webhook ${webhook.name} timed out after 30 seconds`);
      } else {
        this.logger.error(
          `Webhook ${webhook.name} execution failed:`,
          error.message,
        );
      }
      // Don't throw the error to prevent breaking the notification flow
    }

    // Track the execution
    try {
      await this.entityExecutionService.create({
        type: ExecutionType.WEBHOOK,
        status: executionStatus,
        entityName: webhook.name,
        entityId: webhook.id,
        userId,
        input: JSON.stringify({
          webhookId,
          method: webhook.method,
          url: webhook.url,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Zentik-Webhook/1.0',
            ...webhook.headers?.reduce(
              (acc, header) => ({ ...acc, [header.key]: header.value }),
              {},
            ),
          },
          body: ['POST', 'PUT', 'PATCH'].includes(webhook.method)
            ? webhook.body
              ? { ...webhook.body, timestamp: new Date().toISOString() }
              : { timestamp: new Date().toISOString() }
            : undefined,
        }),
        output: responseBody,
        errors: executionErrors,
        durationMs: Date.now() - startTime,
      });
    } catch (trackingError) {
      this.logger.error('Failed to track webhook execution:', trackingError);
      // Don't throw tracking errors to prevent breaking the notification flow
    }
  }
}
