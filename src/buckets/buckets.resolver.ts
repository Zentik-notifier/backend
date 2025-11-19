import { Injectable, UseGuards } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { ResourceType } from '../auth/dto/auth.dto';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { BucketsService } from './buckets.service';
import {
  CreateBucketDto,
  UpdateBucketDto,
  SnoozeScheduleInput,
  SetBucketSnoozeMinutesInput,
  BucketPermissionsDto,
} from './dto';
import { Bucket } from '../entities/bucket.entity';
import { EntityPermission } from '../entities/entity-permission.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import {
  GrantEntityPermissionInput,
  RevokeEntityPermissionInput,
} from '../entity-permission/dto/entity-permission.dto';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';

@Resolver(() => Bucket)
@UseGuards(JwtOrAccessTokenGuard)
@Injectable()
export class BucketsResolver {
  constructor(
    private bucketsService: BucketsService,
    private subscriptionService: GraphQLSubscriptionService,
    private entityPermissionService: EntityPermissionService,
    private eventTrackingService: EventTrackingService,
  ) {}

  @Query(() => [Bucket])
  async buckets(@CurrentUser('id') userId: string): Promise<Bucket[]> {
    const buckets = await this.bucketsService.findAll(userId);
    return buckets;
  }

  @ResolveField(() => String, { name: 'name' })
  async nameField(
    @Parent() bucket: Bucket,
    @CurrentUser('id') userId: string,
  ): Promise<string> {
    // If userBucket is pre-loaded and has customName, use it
    if (bucket.userBucket?.customName) {
      return bucket.userBucket.customName;
    }

    // Fallback to loading userBucket if not pre-loaded
    try {
      const userBucket = await this.bucketsService.findUserBucketByBucketAndUser(
        bucket.id,
        userId,
      );
      if (userBucket?.customName) {
        return userBucket.customName;
      }
    } catch {
      // If no userBucket found, use original name
    }

    // Return original bucket name
    return bucket.name;
  }

  @ResolveField(() => UserBucket, { name: 'userBucket', nullable: true })
  async userBucketField(
    @Parent() bucket: Bucket,
    @CurrentUser('id') userId: string,
  ): Promise<UserBucket | null> {
    // Use pre-loaded userBucket data if available
    if (bucket.userBucket) {
      return bucket.userBucket;
    }

    // Fallback to database query if userBucket not pre-loaded
    try {
      const result = await this.bucketsService.findUserBucketByBucketAndUser(
        bucket.id,
        userId,
      );
      return result;
    } catch {
      return null;
    }
  }

  @ResolveField(() => [EntityPermission], { name: 'permissions' })
  async permissionsField(
    @Parent() bucket: Bucket,
    @CurrentUser('id') userId: string,
  ): Promise<EntityPermission[]> {
    return this.entityPermissionService.getResourcePermissions(
      ResourceType.BUCKET,
      bucket.id,
      userId,
    );
  }

  @ResolveField(() => BucketPermissionsDto, { name: 'userPermissions' })
  async userPermissionsField(
    @Parent() bucket: Bucket,
    @CurrentUser('id') userId: string,
  ): Promise<BucketPermissionsDto> {
    return this.bucketsService.calculateBucketPermissions(bucket, userId);
  }

  @Query(() => Bucket)
  async bucket(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Bucket> {
    return this.bucketsService.findOne(id, userId);
  }

  @Mutation(() => Bucket)
  async createBucket(
    @Args('input') input: CreateBucketDto,
    @CurrentUser('id') userId: string,
  ): Promise<Bucket> {
    const bucket = await this.bucketsService.create(userId, input as any);

    // Publish to subscriptions
    await this.subscriptionService.publishBucketCreated(bucket, userId);

    return bucket;
  }

  @Mutation(() => Bucket)
  async updateBucket(
    @Args('id') id: string,
    @Args('input') input: UpdateBucketDto,
    @CurrentUser('id') userId: string,
  ): Promise<Bucket> {
    const bucket = await this.bucketsService.update(id, userId, input as any);

    // Get all users who have access to this bucket
    const allUserIds = await this.getAllUsersWithBucketAccess(
      bucket.id,
      userId,
    );

    // Publish to all users who have access
    await this.subscriptionService.publishBucketUpdatedToAllUsers(
      bucket,
      userId,
      allUserIds,
    );

    return bucket;
  }

  @Mutation(() => Boolean)
  async deleteBucket(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.bucketsService.remove(id, userId);

    // Publish to subscriptions
    await this.subscriptionService.publishBucketDeleted(id, userId);

    return true;
  }

  /**
   * Get all users who have access to a bucket (owner + shared users)
   */
  private async getAllUsersWithBucketAccess(
    bucketId: string,
    requesterId: string,
  ): Promise<string[]> {
    try {
      // Get the bucket to find the owner
      const bucket = await this.bucketsService.findOne(bucketId, requesterId);
      const userIds = new Set<string>();

      // Add the bucket owner
      userIds.add(bucket.user.id);

      // Get all users who have permissions on this bucket
      const permissions =
        await this.entityPermissionService.getResourcePermissions(
          ResourceType.BUCKET,
          bucketId,
          requesterId,
        );

      // Add all users who have permissions
      permissions.forEach((permission) => {
        if (permission.user?.id) {
          userIds.add(permission.user.id);
        }
      });

      return Array.from(userIds);
    } catch (error) {
      // Fallback to just the requester if there's an error
      return [requesterId];
    }
  }

  @Query(() => [EntityPermission])
  async bucketPermissions(
    @Args('bucketId') bucketId: string,
    @CurrentUser('id') userId: string,
  ): Promise<EntityPermission[]> {
    return this.entityPermissionService.getResourcePermissions(
      ResourceType.BUCKET,
      bucketId,
      userId,
    );
  }

  @Mutation(() => EntityPermission)
  async shareBucket(
    @Args('input') input: GrantEntityPermissionInput,
    @CurrentUser('id') userId: string,
  ): Promise<EntityPermission> {
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;

    const userIdentifier = {
      userId: input.userId,
      userEmail: input.userEmail,
      username: input.username,
    };

    const permission = await this.entityPermissionService.grantPermissions(
      ResourceType.BUCKET,
      input.resourceId,
      userIdentifier,
      input.permissions,
      userId,
      expiresAt,
    );

    // Get all users who have access to this bucket
    const allUserIds = await this.getAllUsersWithBucketAccess(
      input.resourceId,
      userId,
    );

    // Get the updated bucket to publish the update
    const updatedBucket = await this.bucketsService.findOne(
      input.resourceId,
      userId,
    );

    // Publish bucket update to all users who have access
    await this.subscriptionService.publishBucketUpdatedToAllUsers(
      updatedBucket,
      userId,
      allUserIds,
    );

    // Notify subscribers about permission changes for this bucket
    await this.subscriptionService.publishEntityPermissionUpdated(
      permission,
      input.resourceId,
      userId,
    );

    return permission;
  }

  @Mutation(() => Boolean)
  async unshareBucket(
    @Args('input') input: RevokeEntityPermissionInput,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    const userIdentifier = {
      userId: input.userId,
      userEmail: input.userEmail,
      username: input.username,
    };

    await this.entityPermissionService.revokePermissions(
      ResourceType.BUCKET,
      input.resourceId,
      userIdentifier,
      userId,
    );

    // Get all users who still have access to this bucket
    const allUserIds = await this.getAllUsersWithBucketAccess(
      input.resourceId,
      userId,
    );

    // After revoke, publish a bucket update to all users who still have access
    const updatedBucket = await this.bucketsService.findOne(
      input.resourceId,
      userId,
    );
    await this.subscriptionService.publishBucketUpdatedToAllUsers(
      updatedBucket,
      userId,
      allUserIds,
    );
    return true;
  }

  @Mutation(() => UserBucket, {
    deprecationReason: 'Usa Bucket.setBucketSnooze (questo sarà rimosso)',
  })
  async setBucketSnooze(
    @Args('bucketId', { type: () => String }) bucketId: string,
    @Args('snoozeUntil', { type: () => String, nullable: true })
    snoozeUntil: string | null,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.bucketsService.setBucketSnooze(
      bucketId,
      userId,
      snoozeUntil,
    );

    // Pubblica subito un evento per aggiornare i client con lo stato più recente
    try {
      await this.subscriptionService.publishUserBucketUpdated(
        result,
        bucketId,
        userId,
      );
    } catch (err) {}
    return result;
  }

  @Mutation(() => UserBucket, {
    deprecationReason: 'Usa future Bucket mutation (updateBucketSnoozes)',
  })
  async updateBucketSnoozes(
    @Args('bucketId', { type: () => String }) bucketId: string,
    @Args('snoozes', { type: () => [SnoozeScheduleInput] })
    snoozes: SnoozeScheduleInput[],
    @CurrentUser('id') userId: string,
  ) {
    return this.bucketsService.updateBucketSnoozes(bucketId, userId, snoozes);
  }

  @Mutation(() => UserBucket)
  async setBucketSnoozeMinutes(
    @Args('bucketId', { type: () => String }) bucketId: string,
    @Args('input') input: SetBucketSnoozeMinutesInput,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.bucketsService.setBucketSnoozeMinutes(
      bucketId,
      userId,
      input.minutes,
    );
    return result;
  }

  // Subscriptions - these still need Context for WebSocket filtering
  @Subscription(() => Bucket, {
    filter: (payload, variables, context) => {
      // Only send bucket events to the user who owns them
      const userId = context?.req?.user?.id;
      return userId && payload.userId === userId;
    },
  })
  bucketCreated() {
    return this.subscriptionService.bucketCreated();
  }

  @Subscription(() => Bucket, {
    filter: (payload, variables, context) => {
      const userId = context?.req?.user?.id;
      return userId && payload.userId === userId;
    },
  })
  bucketUpdated() {
    return this.subscriptionService.bucketUpdated();
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      const userId = context?.req?.user?.id;
      return userId && payload.userId === userId;
    },
  })
  bucketDeleted() {
    return this.subscriptionService.bucketDeleted();
  }

  @Subscription(() => UserBucket, {
    filter: (payload, variables, context) => {
      const userId = context?.req?.user?.id;
      if (!userId || payload.userId !== userId) return false;
      if (variables?.bucketId) {
        return payload.bucketId === variables.bucketId;
      }
      return true;
    },
  })
  userBucketUpdated(
    @Args('bucketId', { type: () => String, nullable: true }) bucketId?: string,
  ) {
    return this.subscriptionService.userBucketUpdated();
  }

  @Subscription(() => EntityPermission, {
    filter: (payload, variables, context) => {
      const userId = context?.req?.user?.id;
      if (!userId || payload.userId !== userId) return false;
      if (variables?.bucketId) {
        return payload.bucketId === variables.bucketId;
      }
      return true;
    },
  })
  entityPermissionUpdated(
    @Args('bucketId', { type: () => String, nullable: true }) bucketId?: string,
  ) {
    return this.subscriptionService.entityPermissionUpdated();
  }
}
