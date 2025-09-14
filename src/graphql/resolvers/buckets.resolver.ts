import { Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { ResourceType } from 'src/auth/dto/auth.dto';
import { JwtOrAccessTokenGuard } from '../../auth/guards/jwt-or-access-token.guard';
import { BucketsService } from '../../buckets/buckets.service';
import { CreateBucketDto, UpdateBucketDto, SnoozeScheduleInput } from '../../buckets/dto';
import { Bucket } from '../../entities/bucket.entity';
import { EntityPermission } from '../../entities/entity-permission.entity';
import { UserBucket } from '../../entities/user-bucket.entity';
import {
  GrantEntityPermissionInput,
  RevokeEntityPermissionInput,
} from '../../entity-permission/dto/entity-permission.dto';
import { EntityPermissionService } from '../../entity-permission/entity-permission.service';
import { EventTrackingService } from '../../events/event-tracking.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { GraphQLSubscriptionService } from '../services/graphql-subscription.service';

@Resolver(() => Bucket)
@UseGuards(JwtOrAccessTokenGuard)
@Injectable()
export class BucketsResolver {
  private readonly logger = new Logger(BucketsResolver.name);

  constructor(
    private bucketsService: BucketsService,
    private subscriptionService: GraphQLSubscriptionService,
    private entityPermissionService: EntityPermissionService,
    private eventTrackingService: EventTrackingService,
  ) {}

  @Query(() => [Bucket])
  async buckets(@CurrentUser('id') userId: string): Promise<Bucket[]> {
    return this.bucketsService.findAll(userId);
  }

  @ResolveField(() => Boolean, { name: 'isSnoozed' })
  async isSnoozedField(
    @Parent() bucket: Bucket,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    return this.bucketsService.isBucketSnoozed(bucket.id, userId);
  }

  @ResolveField(() => UserBucket, { name: 'userBucket', nullable: true })
  async userBucketField(
    @Parent() bucket: Bucket,
    @CurrentUser('id') userId: string,
  ): Promise<UserBucket | null> {
    try {
      return await this.bucketsService.findUserBucketByBucketAndUser(
        bucket.id,
        userId,
      );
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
      this.logger.error(
        `Error getting users with bucket access: ${error.message}`,
        error.stack,
      );
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

  @Mutation(() => UserBucket, { deprecationReason: 'Usa Bucket.setBucketSnooze (questo sarà rimosso)' })
  async setBucketSnooze(
    @Args('bucketId', { type: () => String }) bucketId: string,
    @Args('snoozeUntil', { type: () => String, nullable: true })
    snoozeUntil: string | null,
    @CurrentUser('id') userId: string,
  ) {
    return this.bucketsService.setBucketSnooze(bucketId, userId, snoozeUntil);
  }

  @Mutation(() => UserBucket, { deprecationReason: 'Usa future Bucket mutation (updateBucketSnoozes)' })
  async updateBucketSnoozes(
    @Args('bucketId', { type: () => String }) bucketId: string,
    @Args('snoozes', { type: () => [SnoozeScheduleInput] })
    snoozes: SnoozeScheduleInput[],
    @CurrentUser('id') userId: string,
  ) {
    return this.bucketsService.updateBucketSnoozes(bucketId, userId, snoozes);
  }

  @Query(() => Boolean, { name: 'isBucketSnoozed', deprecationReason: 'Usa field Bucket.isSnoozed' })
  async getSnoozeStatus(
    @Args('bucketId', { type: () => String }) bucketId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.bucketsService.isBucketSnoozed(bucketId, userId);
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
