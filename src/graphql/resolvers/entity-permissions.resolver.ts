import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtOrAccessTokenGuard } from '../../auth/guards/jwt-or-access-token.guard';
import { EntityPermission } from '../../entities/entity-permission.entity';
import {
  GetResourcePermissionsInput,
  GrantEntityPermissionInput,
  RevokeEntityPermissionInput,
} from '../../entity-permission/dto/entity-permission.dto';
import { EntityPermissionService } from '../../entity-permission/entity-permission.service';
import { CurrentUser } from '../decorators/current-user.decorator';

@Resolver(() => EntityPermission)
@UseGuards(JwtOrAccessTokenGuard)
@Injectable()
export class EntityPermissionsResolver {
  constructor(private entityPermissionService: EntityPermissionService) {}

  @Query(() => [EntityPermission])
  async getResourcePermissions(
    @Args('input') input: GetResourcePermissionsInput,
    @CurrentUser('id') userId: string,
  ): Promise<EntityPermission[]> {
    return this.entityPermissionService.getResourcePermissions(
      input.resourceType,
      input.resourceId,
      userId,
    );
  }

  @Mutation(() => EntityPermission)
  async grantEntityPermission(
    @Args('input') input: GrantEntityPermissionInput,
    @CurrentUser('id') userId: string,
  ): Promise<EntityPermission> {
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;

    const userIdentifier = {
      userId: input.userId,
      userEmail: input.userEmail,
      username: input.username,
    };

    return this.entityPermissionService.grantPermissions(
      input.resourceType,
      input.resourceId,
      userIdentifier,
      input.permissions,
      userId,
      expiresAt,
    );
  }

  @Mutation(() => Boolean)
  async revokeEntityPermission(
    @Args('input') input: RevokeEntityPermissionInput,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
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
    return true;
  }

  @Mutation(() => Number)
  async cleanupExpiredPermissions(): Promise<number> {
    return this.entityPermissionService.cleanupExpiredPermissions();
  }
}
