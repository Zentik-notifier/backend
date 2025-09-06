import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
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
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { OAuthProvider, OAuthProviderType } from '../entities';
import { CreateOAuthProviderDto, UpdateOAuthProviderDto } from './dto/index';
import { OAuthProvidersService } from './oauth-providers.service';

@ApiTags('OAuth Providers')
@Controller('oauth-providers')
export class OAuthProvidersController {
  private readonly logger = new Logger(OAuthProvidersController.name);

  constructor(private readonly oauthProvidersService: OAuthProvidersService) {}

  @Post()
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new OAuth provider (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'OAuth provider created successfully',
    type: OAuthProvider,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 409,
    description: 'Provider with same providerId already exists',
  })
  async create(
    @Body() createOAuthProviderDto: CreateOAuthProviderDto,
  ): Promise<OAuthProvider> {
    this.logger.log('Creating new OAuth provider');
    return this.oauthProvidersService.create(createOAuthProviderDto);
  }

  @Get()
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all OAuth providers (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of all OAuth providers',
    type: [OAuthProvider],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async findAll(): Promise<OAuthProvider[]> {
    this.logger.log('Fetching all OAuth providers');
    return this.oauthProvidersService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get OAuth provider by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'OAuth provider ID' })
  @ApiResponse({
    status: 200,
    description: 'OAuth provider found',
    type: OAuthProvider,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'OAuth provider not found' })
  async findOne(@Param('id') id: string): Promise<OAuthProvider> {
    this.logger.log(`Fetching OAuth provider: ${id}`);
    return this.oauthProvidersService.findOne(id);
  }

  @Get('by-provider/:providerId')
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get OAuth provider by provider ID (Admin only)' })
  @ApiParam({
    name: 'providerId',
    description: 'OAuth provider identifier (e.g., github, google)',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth provider found',
    type: OAuthProvider,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'OAuth provider not found' })
  async findByProviderId(
    @Param('providerId') providerId: string,
  ): Promise<OAuthProvider> {
    this.logger.log(`Fetching OAuth provider by providerId: ${providerId}`);
    const provider =
      await this.oauthProvidersService.findByProviderId(providerId);
    if (!provider) {
      throw new Error(
        `OAuth provider with providerId '${providerId}' not found`,
      );
    }
    return provider;
  }

  @Patch(':id')
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update OAuth provider (Admin only)' })
  @ApiParam({ name: 'id', description: 'OAuth provider ID' })
  @ApiResponse({
    status: 200,
    description: 'OAuth provider updated successfully',
    type: OAuthProvider,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'OAuth provider not found' })
  @ApiResponse({
    status: 409,
    description: 'Provider with same providerId already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updateOAuthProviderDto: UpdateOAuthProviderDto,
  ): Promise<OAuthProvider> {
    this.logger.log(`Updating OAuth provider: ${id}`);
    return this.oauthProvidersService.update(id, updateOAuthProviderDto);
  }

  @Patch(':id/toggle')
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Toggle OAuth provider enabled status (Admin only)',
  })
  @ApiParam({ name: 'id', description: 'OAuth provider ID' })
  @ApiResponse({
    status: 200,
    description: 'OAuth provider status toggled successfully',
    type: OAuthProvider,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'OAuth provider not found' })
  async toggleEnabled(@Param('id') id: string): Promise<OAuthProvider> {
    this.logger.log(`Toggling enabled status for OAuth provider: ${id}`);
    return this.oauthProvidersService.toggleEnabled(id);
  }

  @Delete(':id')
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete OAuth provider (Admin only)' })
  @ApiParam({ name: 'id', description: 'OAuth provider ID' })
  @ApiResponse({
    status: 204,
    description: 'OAuth provider deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'OAuth provider not found' })
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting OAuth provider: ${id}`);
    await this.oauthProvidersService.remove(id);
  }

  @Get(':id/config')
  @UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get OAuth provider configuration for authentication (Admin only)',
  })
  @ApiParam({ name: 'id', description: 'OAuth provider ID' })
  @ApiResponse({
    status: 200,
    description: 'OAuth provider configuration',
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        clientSecret: { type: 'string' },
        callbackUrl: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        type: { type: 'string', enum: Object.values(OAuthProviderType) },
        authorizationUrl: { type: 'string' },
        tokenUrl: { type: 'string' },
        userInfoUrl: { type: 'string' },
        profileFields: { type: 'array', items: { type: 'string' } },
        additionalConfig: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'OAuth provider not found' })
  async getProviderConfig(@Param('id') id: string): Promise<any> {
    this.logger.log(`Getting configuration for OAuth provider: ${id}`);
    const provider = await this.oauthProvidersService.findOne(id);
    return this.oauthProvidersService.getProviderConfig(provider.providerId);
  }
}
