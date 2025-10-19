import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
  UpdateAccessTokenDto,
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

  @Get(':tokenId')
  @ApiOperation({ summary: 'Get a specific access token' })
  @ApiResponse({
    status: 200,
    description: 'Access token retrieved successfully',
    type: AccessTokenListDto,
  })
  async getAccessToken(
    @GetUser('id') userId: string,
    @Param('tokenId') tokenId: string,
  ): Promise<AccessTokenListDto> {
    return this.accessTokenService.getAccessToken(userId, tokenId);
  }

  @Get('bucket/:bucketId')
  @ApiOperation({ summary: 'Get access tokens that have access to a specific bucket' })
  @ApiResponse({
    status: 200,
    description: 'Access tokens for bucket retrieved successfully',
    type: [AccessTokenListDto],
  })
  async getAccessTokensForBucket(
    @GetUser('id') userId: string,
    @Param('bucketId') bucketId: string,
  ): Promise<AccessTokenListDto[]> {
    return this.accessTokenService.getAccessTokensForBucket(userId, bucketId);
  }

  @Post('bucket/:bucketId')
  @ApiOperation({ summary: 'Create an access token for a specific bucket' })
  @ApiResponse({
    status: 201,
    description: 'Access token for bucket created successfully',
    type: AccessTokenResponseDto,
  })
  async createAccessTokenForBucket(
    @GetUser('id') userId: string,
    @Param('bucketId') bucketId: string,
    @Body('name') name: string,
  ): Promise<AccessTokenResponseDto> {
    return this.accessTokenService.createAccessTokenForBucket(userId, bucketId, name);
  }

  @Patch(':tokenId')
  @ApiOperation({ summary: 'Update an access token' })
  @ApiResponse({
    status: 200,
    description: 'Access token updated successfully',
    type: AccessTokenListDto,
  })
  async updateAccessToken(
    @GetUser('id') userId: string,
    @Param('tokenId') tokenId: string,
    @Body() updateDto: UpdateAccessTokenDto,
  ): Promise<AccessTokenListDto> {
    return this.accessTokenService.updateAccessToken(userId, tokenId, updateDto);
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
