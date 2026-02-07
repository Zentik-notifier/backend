import { UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ResourceType } from '../auth/dto/auth.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { EntityPermission } from '../entities/entity-permission.entity';
import { ExternalNotifySystem } from '../entities/external-notify-system.entity';
import {
  GrantEntityPermissionInput,
  ResourcePermissionsDto,
  RevokeEntityPermissionInput,
} from '../entity-permission/dto/entity-permission.dto';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import {
  CreateExternalNotifySystemDto,
  UpdateExternalNotifySystemDto,
} from './dto';
import { ExternalNotifySystemService } from './external-notify-system.service';

@Resolver(() => ExternalNotifySystem)
@UseGuards(JwtOrAccessTokenGuard)
export class ExternalNotifySystemResolver {
  constructor(
    private readonly externalNotifySystemService: ExternalNotifySystemService,
    private readonly entityPermissionService: EntityPermissionService,
  ) {}

  @Query(() => [ExternalNotifySystem])
  async externalNotifySystems(@GetUser('id') userId: string) {
    return this.externalNotifySystemService.findAll(userId);
  }

  @Query(() => ExternalNotifySystem)
  async externalNotifySystem(
    @Args('id', { type: () => ID }) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.externalNotifySystemService.findOne(id, userId);
  }

  @ResolveField(() => [EntityPermission], { name: 'permissions' })
  async permissionsField(
    @Parent() system: ExternalNotifySystem,
    @GetUser('id') userId: string,
  ) {
    return this.entityPermissionService.getResourcePermissions(
      ResourceType.EXTERNAL_NOTIFY_SYSTEM,
      system.id,
      userId,
    );
  }

  @ResolveField(() => ResourcePermissionsDto, { name: 'userPermissions' })
  async userPermissionsField(
    @Parent() system: ExternalNotifySystem,
    @GetUser('id') userId: string,
  ) {
    return this.externalNotifySystemService.calculatePermissions(system, userId);
  }

  @Query(() => [EntityPermission])
  async externalNotifySystemPermissions(
    @Args('resourceId') resourceId: string,
    @GetUser('id') userId: string,
  ) {
    return this.entityPermissionService.getResourcePermissions(
      ResourceType.EXTERNAL_NOTIFY_SYSTEM,
      resourceId,
      userId,
    );
  }

  @Mutation(() => ExternalNotifySystem)
  async createExternalNotifySystem(
    @Args('input') input: CreateExternalNotifySystemDto,
    @GetUser('id') userId: string,
  ) {
    return this.externalNotifySystemService.create(userId, input);
  }

  @Mutation(() => ExternalNotifySystem)
  async updateExternalNotifySystem(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateExternalNotifySystemDto,
    @GetUser('id') userId: string,
  ) {
    return this.externalNotifySystemService.update(id, userId, input);
  }

  @Mutation(() => Boolean)
  async deleteExternalNotifySystem(
    @Args('id', { type: () => ID }) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.externalNotifySystemService.remove(id, userId);
  }

  @Mutation(() => EntityPermission)
  async shareExternalNotifySystem(
    @Args('input') input: GrantEntityPermissionInput,
    @GetUser('id') userId: string,
  ) {
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
    const userIdentifier = {
      userId: input.userId,
      userEmail: input.userEmail,
      username: input.username,
    };
    return this.entityPermissionService.grantPermissions(
      ResourceType.EXTERNAL_NOTIFY_SYSTEM,
      input.resourceId,
      userIdentifier,
      input.permissions,
      userId,
      expiresAt,
    );
  }

  @Mutation(() => Boolean)
  async unshareExternalNotifySystem(
    @Args('input') input: RevokeEntityPermissionInput,
    @GetUser('id') userId: string,
  ) {
    const userIdentifier = {
      userId: input.userId,
      userEmail: input.userEmail,
      username: input.username,
    };
    await this.entityPermissionService.revokePermissions(
      ResourceType.EXTERNAL_NOTIFY_SYSTEM,
      input.resourceId,
      userIdentifier,
      userId,
    );
    return true;
  }
}
