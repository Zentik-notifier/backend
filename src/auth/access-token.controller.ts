import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenService } from './access-token.service';
import { GetUser } from './decorators/get-user.decorator';
import {
  AccessTokenListDto,
  AccessTokenResponseDto,
  CreateAccessTokenDto,
} from './dto/auth.dto';
import { JwtOrAccessTokenGuard } from './guards/jwt-or-access-token.guard';

@ApiTags('Access Tokens')
@Controller('access-tokens')
@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
export class AccessTokenController {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new access token' })
  @ApiResponse({
    status: 201,
    description: 'Access token created successfully',
    type: AccessTokenResponseDto,
  })
  async createAccessToken(
    @GetUser('id') userId: string,
    @Body() createDto: CreateAccessTokenDto,
  ): Promise<AccessTokenResponseDto> {
    return this.accessTokenService.createAccessToken(userId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all access tokens for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Access tokens retrieved successfully',
    type: [AccessTokenListDto],
  })
  async getUserAccessTokens(
    @GetUser('id') userId: string,
  ): Promise<AccessTokenListDto[]> {
    return this.accessTokenService.getUserAccessTokens(userId);
  }

  @Delete(':tokenId')
  @ApiOperation({ summary: 'Revoke a specific access token' })
  @ApiResponse({
    status: 200,
    description: 'Access token revoked successfully',
  })
  async revokeAccessToken(
    @GetUser('id') userId: string,
    @Param('tokenId') tokenId: string,
  ): Promise<{ success: boolean }> {
    const success = await this.accessTokenService.revokeAccessToken(
      userId,
      tokenId,
    );
    return { success };
  }

  @Delete()
  @ApiOperation({ summary: 'Revoke all access tokens for the current user' })
  @ApiResponse({
    status: 200,
    description: 'All access tokens revoked successfully',
  })
  async revokeAllAccessTokens(
    @GetUser('id') userId: string,
  ): Promise<{ success: boolean }> {
    const success = await this.accessTokenService.revokeAllAccessTokens(userId);
    return { success };
  }
}
