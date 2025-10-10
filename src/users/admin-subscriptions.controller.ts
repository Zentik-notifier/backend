import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import {
  CreateAdminSubscriptionDto,
  UpdateAdminSubscriptionDto,
} from './dto/admin-subscription.dto';
import { AdminSubscription } from '../entities/admin-subscription.entity';

@ApiTags('Admin Subscriptions')
@ApiBearerAuth()
@Controller('admin-subscriptions')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class AdminSubscriptionsController {
  constructor(
    private readonly adminSubscriptionsService: AdminSubscriptionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create or update admin subscription for current user' })
  async create(
    @Req() req: any,
    @Body() createDto: CreateAdminSubscriptionDto,
  ): Promise<AdminSubscription> {
    return this.adminSubscriptionsService.create(req.user.userId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all admin subscriptions (admin only)' })
  async findAll(): Promise<AdminSubscription[]> {
    return this.adminSubscriptionsService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user admin subscription' })
  async findMine(@Req() req: any): Promise<AdminSubscription | null> {
    return this.adminSubscriptionsService.findByUserId(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin subscription by ID' })
  async findOne(@Param('id') id: string): Promise<AdminSubscription> {
    return this.adminSubscriptionsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update admin subscription' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAdminSubscriptionDto,
  ): Promise<AdminSubscription> {
    return this.adminSubscriptionsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete admin subscription' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.adminSubscriptionsService.remove(id);
  }
}
