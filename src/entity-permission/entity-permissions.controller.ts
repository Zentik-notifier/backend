import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResourceType } from 'src/auth/dto/auth.dto';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { EntityPermission } from '../entities/entity-permission.entity';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import {
  GrantEntityPermissionInput,
  RevokeEntityPermissionInput,
} from './dto/entity-permission.dto';
import { EntityPermissionService } from './entity-permission.service';

@ApiTags('Entity Permissions')
@Controller('entity-permissions')
@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
export class EntityPermissionsController {
  constructor(
    private readonly entityPermissionService: EntityPermissionService,
  ) {}

  @Get('resource-permissions')
  @ApiOperation({ summary: 'Get permissions for a specific resource' })
  @ApiResponse({
    status: 200,
    description: 'Resource permissions retrieved successfully',
    type: [EntityPermission],
  })
  async getResourcePermissions(
    @Query('resourceType') resourceType: ResourceType,
    @Query('resourceId') resourceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<EntityPermission[]> {
    return this.entityPermissionService.getResourcePermissions(
      resourceType,
      resourceId,
      userId,
    );
  }

  @Post('grant')
  @ApiOperation({ summary: 'Grant permissions to a user for a resource' })
  @ApiResponse({
    status: 201,
    description: 'Permissions granted successfully',
    type: EntityPermission,
  })
  async grantPermissions(
    @Body() input: GrantEntityPermissionInput,
    @CurrentUser('id') userId: string,
  ): Promise<EntityPermission> {
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;

    const userIdentifier = {
      userId: input.userId,
      userEmail: input.userEmail,
      username: input.username,
    };

    const permission = await this.entityPermissionService.grantPermissions(
      input.resourceType,
      input.resourceId,
      userIdentifier,
      input.permissions,
      userId,
      expiresAt,
    );



    return permission;
  }

  @Delete('revoke')
  @ApiOperation({ summary: 'Revoke permissions from a user for a resource' })
  @ApiResponse({ status: 200, description: 'Permissions revoked successfully' })
  async revokePermissions(
    @Body() input: RevokeEntityPermissionInput,
    @CurrentUser('id') userId: string,
  ): Promise<{ message: string }> {
    const userIdentifier = {
      userId: input.userId,
      userEmail: input.userEmail,
      username: input.username,
    };

    await this.entityPermissionService.revokePermissions(
      input.resourceType,
      input.resourceId,
      userIdentifier,
      userId,
    );



    return { message: 'Permissions revoked successfully' };
  }

  @Post('cleanup-expired')
  @ApiOperation({ summary: 'Clean up expired permissions' })
  @ApiResponse({
    status: 200,
    description: 'Expired permissions cleaned up successfully',
  })
  async cleanupExpiredPermissions(): Promise<{ cleaned: number }> {
    const cleaned =
      await this.entityPermissionService.cleanupExpiredPermissions();
    return { cleaned };
  }
}
