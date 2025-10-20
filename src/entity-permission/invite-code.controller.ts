import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { InviteCode } from '../entities/invite-code.entity';
import { InviteCodeService } from './invite-code.service';
import {
  CreateInviteCodeInput,
  RedeemInviteCodeInput,
  InviteCodeRedemptionResult,
} from './dto/invite-code.dto';
import { ResourceType } from '../auth/dto/auth.dto';

@ApiTags('invite-codes')
@Controller('api/v1/invite-codes')
@UseGuards(JwtOrAccessTokenGuard)
export class InviteCodeController {
  constructor(private readonly inviteCodeService: InviteCodeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invite code' })
  async createInviteCode(
    @Body() input: CreateInviteCodeInput,
    @CurrentUser('id') userId: string,
  ): Promise<InviteCode> {
    return this.inviteCodeService.createInviteCode(input, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get invite codes for a resource' })
  async getInviteCodesForResource(
    @Query('resourceType') resourceType: ResourceType,
    @Query('resourceId') resourceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<InviteCode[]> {
    return this.inviteCodeService.getInviteCodesForResource(
      resourceType,
      resourceId,
      userId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invite code by ID' })
  async getInviteCodeById(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<InviteCode> {
    return this.inviteCodeService.getInviteCodeById(id, userId);
  }

  @Post('redeem')
  @ApiOperation({ summary: 'Redeem an invite code' })
  async redeemInviteCode(
    @Body() input: RedeemInviteCodeInput,
    @CurrentUser('id') userId: string,
  ): Promise<InviteCodeRedemptionResult> {
    return this.inviteCodeService.redeemInviteCode(input.code, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an invite code' })
  async deleteInviteCode(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.inviteCodeService.deleteInviteCode(id, userId);
  }
}

