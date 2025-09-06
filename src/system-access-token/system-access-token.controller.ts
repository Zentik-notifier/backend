import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { SystemAccessTokenService } from './system-access-token.service';

@ApiTags('System Access Tokens')
@Controller('system-access-tokens')
@UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class SystemAccessTokenController {
  constructor(private readonly service: SystemAccessTokenService) {}

  @Post()
  @ApiOperation({ summary: 'Create system access token' })
  @ApiResponse({ status: 201 })
  async create(@Body() body: { maxCalls: number; expiresAt?: string }) {
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    return this.service.createToken(body.maxCalls || 0, expiresAt);
  }

  @Get()
  async list() {
    return this.service.findAll();
  }

  @Delete(':id')
  async revoke(@Param('id') id: string) {
    return this.service.revoke(id);
  }
}
