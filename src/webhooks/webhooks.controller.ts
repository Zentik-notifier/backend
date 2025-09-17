import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { UserWebhook } from '../entities';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all webhooks for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of webhooks',
    type: [UserWebhook],
  })
  async getUserWebhooks(@GetUser('id') userId: string): Promise<UserWebhook[]> {
    return this.webhooksService.getUserWebhooks(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({
    status: 200,
    description: 'Webhook details',
    type: UserWebhook,
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getWebhook(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<UserWebhook> {
    return this.webhooksService.getWebhookById(id, userId);
  }
}
