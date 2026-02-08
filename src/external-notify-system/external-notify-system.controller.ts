import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { ExternalNotifySystem } from '../entities/external-notify-system.entity';
import { NtfySubscriptionService } from './providers/ntfy/ntfy-subscription.service';
import { ExternalNotifySystemService } from './external-notify-system.service';
import { CreateExternalNotifySystemDto, UpdateExternalNotifySystemDto } from './dto';

@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
@ApiTags('External notify systems')
@Controller('external-notify-systems')
export class ExternalNotifySystemController {
  constructor(
    private readonly externalNotifySystemService: ExternalNotifySystemService,
    private readonly ntfySubscriptionService: NtfySubscriptionService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an external notify system' })
  @ApiResponse({
    status: 201,
    description: 'External notify system created',
    type: ExternalNotifySystem,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(
    @GetUser('id') userId: string,
    @Body() dto: CreateExternalNotifySystemDto,
  ) {
    return this.externalNotifySystemService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all external notify systems for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of external notify systems',
    type: [ExternalNotifySystem],
  })
  findAll(@GetUser('id') userId: string) {
    return this.externalNotifySystemService.findAll(userId);
  }

  @Post('reload-ntfy-subscriptions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({ summary: 'Reload NTFY subscriptions (admin only)' })
  @ApiResponse({ status: 200, description: 'Subscriptions reloaded' })
  async reloadNtfySubscriptions(): Promise<{ ok: boolean }> {
    await this.ntfySubscriptionService.startAllSubscriptions();
    return { ok: true };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get external notify system by ID' })
  @ApiParam({ name: 'id', description: 'External notify system UUID' })
  @ApiResponse({
    status: 200,
    description: 'External notify system details',
    type: ExternalNotifySystem,
  })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  findOne(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.externalNotifySystemService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an external notify system' })
  @ApiParam({ name: 'id', description: 'External notify system UUID' })
  @ApiResponse({
    status: 200,
    description: 'Updated external notify system',
    type: ExternalNotifySystem,
  })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  update(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() dto: UpdateExternalNotifySystemDto,
  ) {
    return this.externalNotifySystemService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an external notify system' })
  @ApiParam({ name: 'id', description: 'External notify system UUID' })
  @ApiResponse({ status: 200, description: 'Deleted successfully' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  remove(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.externalNotifySystemService.remove(id, userId);
  }
}
