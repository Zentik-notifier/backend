import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';
import { Repository } from 'typeorm';
import { EntityPermission } from '../entities/entity-permission.entity';
import { User } from '../entities/user.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/users.types';
import { generateMagicCode } from '../common/utils/code-generation.utils';

export interface ResourceOwnershipCheck {
  resourceType: ResourceType;
  resourceId: string;
  userId: string;
}

@Injectable()
export class EntityPermissionService {
  private readonly logger = new Logger(EntityPermissionService.name);

  constructor(
    @InjectRepository(EntityPermission)
    private entityPermissionRepository: Repository<EntityPermission>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserBucket)
    private userBucketRepository: Repository<UserBucket>,
    private usersService: UsersService,
    private eventTrackingService: EventTrackingService,
  ) { }

  /**
   * Check if user has required permissions for a resource
   * Note: Admin users automatically have all permissions
   */
  async hasPermissions(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    requiredPermissions: Permission[],
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return false;
    }

    // Check if user owns the resource first
    const isOwner = await this.isResourceOwner(
      userId,
      resourceType,
      resourceId,
    );
    if (isOwner) {
      return true;
    }

    // Admin users have all permissions (but only if they're not the owner)
    // This allows admin users to use invite codes for resources they don't own
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Check explicit permissions
    const permission = await this.entityPermissionRepository.findOne({
      where: {
        user: { id: userId },
        resourceType,
        resourceId,
      },
    });

    if (!permission) {
      return false;
    }

    // Check if permissions are expired
    if (permission.expiresAt && permission.expiresAt < new Date()) {
      await this.entityPermissionRepository.remove(permission);
      return false;
    }

    // If user has ADMIN permission on the resource, treat it as full access
    if (permission.permissions.includes(Permission.ADMIN)) {
      return true;
    }

    return requiredPermissions.every((reqPerm) =>
      permission.permissions.includes(reqPerm),
    );
  }

  /**
   * Check if user has required permissions for a resource (for invite code validation)
   * Note: This method does NOT automatically grant permissions to admin users
   * Admin users must have explicit permissions or be the resource owner
   */
  async hasPermissionsForInviteCode(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    requiredPermissions: Permission[],
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return false;
    }

    // Check if user owns the resource
    const isOwner = await this.isResourceOwner(
      userId,
      resourceType,
      resourceId,
    );
    if (isOwner) {
      return true;
    }

    // Check explicit permissions (admin users are NOT automatically granted permissions)
    const permission = await this.entityPermissionRepository.findOne({
      where: {
        user: { id: userId },
        resourceType,
        resourceId,
      },
    });

    if (!permission) {
      return false;
    }

    // Check if permissions are expired
    if (permission.expiresAt && permission.expiresAt < new Date()) {
      await this.entityPermissionRepository.remove(permission);
      return false;
    }

    return requiredPermissions.every((reqPerm) =>
      permission.permissions.includes(reqPerm),
    );
  }


  private async createUserBucketIfNeeded(
    resourceType: ResourceType,
    resourceId: string,
    userId: string,
  ): Promise<void> {
    if (resourceType === ResourceType.BUCKET) {
      const existing = await this.userBucketRepository.findOne({
        where: { userId, bucketId: resourceId },
      });
      
      if (!existing) {
        const magicCode = generateMagicCode();
        const userBucket = this.userBucketRepository.create({
          bucketId: resourceId,
          userId,
          magicCode,
        });
        await this.userBucketRepository.save(userBucket);
      }
    }
  }

  /**
   * Grant permissions to a user for a resource using email/username identifier
   */
  async grantPermissions(
    resourceType: ResourceType,
    resourceId: string,
    userIdentifier: { userId?: string; userEmail?: string; username?: string },
    permissions: Permission[],
    granterUserId: string,
    expiresAt?: Date,
  ): Promise<EntityPermission> {
    // Check if granter has permission to grant access
    const canGrant = await this.canManagePermissions(
      granterUserId,
      resourceType,
      resourceId,
    );
    if (!canGrant) {
      throw new ForbiddenException(
        'You do not have permission to grant access to this resource',
      );
    }

    // Find the target user
    const user = await this.usersService.findByIdentifier(userIdentifier);

    // Prevent self-sharing
    if (user.id === granterUserId) {
      throw new ForbiddenException('You cannot share a resource with yourself');
    }

    const granter = await this.userRepository.findOne({
      where: { id: granterUserId },
    });
    if (!granter) {
      throw new NotFoundException('Granter user not found');
    }

    // Check if permission already exists
    let permission = await this.entityPermissionRepository.findOne({
      where: {
        user: { id: user.id },
        resourceType,
        resourceId,
      },
    });

    if (permission) {
      // Update existing permissions
      permission.permissions = permissions;
      permission.grantedBy = granter;
      if (expiresAt !== undefined) {
        permission.expiresAt = expiresAt;
      }
      const savedPermission =
        await this.entityPermissionRepository.save(permission);

      // Create UserBucket if needed for buckets
      await this.createUserBucketIfNeeded(resourceType, resourceId, user.id);

      // Track bucket sharing event if it's a bucket resource
      if (resourceType === ResourceType.BUCKET) {
        try {
          await this.eventTrackingService.trackBucketSharing(
            granterUserId,
            resourceId,
            user.id,
          );
        } catch (trackingError) {
          this.logger.warn(
            `Failed to track bucket sharing event: ${trackingError.message}`,
          );
        }
      }

      return savedPermission;
    } else {
      // Create new permission
      permission = this.entityPermissionRepository.create({
        user,
        grantedBy: granter,
        resourceType,
        resourceId,
        permissions,
        expiresAt,
      });
      const savedPermission =
        await this.entityPermissionRepository.save(permission);

      // Create UserBucket if needed for buckets
      await this.createUserBucketIfNeeded(resourceType, resourceId, user.id);

      // Track bucket sharing event if it's a bucket resource
      if (resourceType === ResourceType.BUCKET) {
        try {
          await this.eventTrackingService.trackBucketSharing(
            granterUserId,
            resourceId,
            user.id,
          );
        } catch (trackingError) {
          this.logger.warn(
            `Failed to track bucket sharing event: ${trackingError.message}`,
          );
        }
      }

      return savedPermission;
    }
  }

  /**
   * Revoke permissions from a user for a resource using email/username identifier
   */
  async revokePermissions(
    resourceType: ResourceType,
    resourceId: string,
    userIdentifier: { userId?: string; userEmail?: string; username?: string },
    revokerUserId: string,
  ): Promise<void> {
    // Check if revoker has permission to revoke access
    const canRevoke = await this.canManagePermissions(
      revokerUserId,
      resourceType,
      resourceId,
    );
    if (!canRevoke) {
      throw new ForbiddenException(
        'You do not have permission to revoke access to this resource',
      );
    }

    // Find the target user
    const user = await this.usersService.findByIdentifier(userIdentifier);

    const permission = await this.entityPermissionRepository.findOne({
      where: {
        user: { id: user.id },
        resourceType,
        resourceId,
      },
    });

    if (permission) {
      // Track bucket unsharing event if it's a bucket resource
      if (resourceType === ResourceType.BUCKET) {
        try {
          await this.eventTrackingService.trackBucketUnsharing(
            revokerUserId,
            resourceId,
            user.id,
          );
        } catch (trackingError) {
          this.logger.warn(
            `Failed to track bucket unsharing event: ${trackingError.message}`,
          );
        }
      }

      await this.entityPermissionRepository.remove(permission);
    }
  }

  /**
   * Get all permissions for a resource
   */
  async getResourcePermissions(
    resourceType: ResourceType,
    resourceId: string,
    requesterId: string,
  ): Promise<EntityPermission[]> {
    const canView = await this.canViewPermissions(
      requesterId,
      resourceType,
      resourceId,
    );
    if (!canView) {
      throw new ForbiddenException(
        'You do not have permission to view permissions for this resource',
      );
    }

    return await this.entityPermissionRepository.find({
      where: { resourceType, resourceId },
      relations: ['user', 'grantedBy'],
    });
  }

  /**
   * Clean up expired permissions
   */
  async cleanupExpiredPermissions(): Promise<number> {
    const result = await this.entityPermissionRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }

  /**
   * Check if user can manage permissions for a resource
   */
  private async canManagePermissions(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return false;
    }

    // Admin users can manage all permissions
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Check if user owns the resource
    const isOwner = await this.isResourceOwner(
      userId,
      resourceType,
      resourceId,
    );
    if (isOwner) {
      return true;
    }

    // Users with ADMIN permission on the resource can manage permissions
    return await this.hasPermissions(userId, resourceType, resourceId, [
      Permission.ADMIN,
    ]);
  }

  /**
   * Check if user can view permissions for a resource
   * More permissive than canManagePermissions - allows viewing if user is involved
   */
  private async canViewPermissions(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return false;
    }

    // Admin users can view all permissions
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Check if user owns the resource
    const isOwner = await this.isResourceOwner(
      userId,
      resourceType,
      resourceId,
    );
    if (isOwner) {
      return true;
    }

    // Users with ADMIN permission on the resource can view permissions
    const hasAdminPermission = await this.hasPermissions(
      userId,
      resourceType,
      resourceId,
      [Permission.ADMIN],
    );
    if (hasAdminPermission) {
      return true;
    }

    // Check if user has any permission on this resource (is a target of sharing)
    const hasAnyPermission = await this.entityPermissionRepository.findOne({
      where: {
        resourceType,
        resourceId,
        user: { id: userId },
      },
    });
    if (hasAnyPermission) {
      return true;
    }

    // Check if user has granted any permission for this resource (is a source of sharing)
    const hasGrantedPermission = await this.entityPermissionRepository.findOne({
      where: {
        resourceType,
        resourceId,
        grantedBy: { id: userId },
      },
    });
    if (hasGrantedPermission) {
      return true;
    }

    if (resourceType === ResourceType.BUCKET) {
      // Check if user has any access to the bucket (READ, WRITE, etc.)
      const hasAnyAccess = await this.hasPermissions(
        userId,
        resourceType,
        resourceId,
        [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
      );

      if (hasAnyAccess) {
        return true;
      }

      // Check if it's a public bucket
      const bucketRepo = this.entityPermissionRepository.manager.getRepository('Bucket');
      const bucket = await bucketRepo.findOne({
        where: { id: resourceId },
        select: ['isPublic', 'isAdmin'],
      });

      if (bucket?.isPublic) {
        return true;
      }

      // Check if it's an admin bucket and user is moderator
      if (bucket?.isAdmin && user.role === UserRole.MODERATOR) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user owns a resource
   */
  private async isResourceOwner(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<boolean> {
    // This method should be implemented based on your specific ownership logic
    // For now, I'll implement basic checks for known resource types

    switch (resourceType) {
      case ResourceType.BUCKET:
        const bucketRepo =
          this.entityPermissionRepository.manager.getRepository('Bucket');
        const bucket = await bucketRepo.findOne({
          where: { id: resourceId },
          relations: ['user'],
        });
        return bucket?.user?.id === userId;

      case ResourceType.USER_WEBHOOK:
        const webhookRepo =
          this.entityPermissionRepository.manager.getRepository('UserWebhook');
        const webhook = await webhookRepo.findOne({
          where: { id: resourceId },
          relations: ['user'],
        });
        return webhook?.user?.id === userId;

      default:
        return false;
    }
  }

  /**
   * Get all resource IDs of a specific type
   */
  private async getAllResourceIds(
    resourceType: ResourceType,
  ): Promise<string[]> {
    let tableName: string;

    switch (resourceType) {
      case ResourceType.BUCKET:
        tableName = 'buckets';
        break;
      case ResourceType.USER_WEBHOOK:
        tableName = 'user_webhooks';
        break;
      default:
        return [];
    }

    const result = await this.entityPermissionRepository.manager
      .createQueryBuilder()
      .select('id')
      .from(tableName, 'resource')
      .getRawMany();

    return result.map((r) => r.id);
  }

  /**
   * Get resource IDs owned by a user
   */
  private async getOwnedResourceIds(
    userId: string,
    resourceType: ResourceType,
  ): Promise<string[]> {
    let tableName: string;

    switch (resourceType) {
      case ResourceType.BUCKET:
        tableName = 'buckets';
        break;
      case ResourceType.USER_WEBHOOK:
        tableName = 'user_webhooks';
        break;
      default:
        return [];
    }

    const result = await this.entityPermissionRepository.manager
      .createQueryBuilder()
      .select('id')
      .from(tableName, 'resource')
      .where('resource.userId = :userId', { userId })
      .getRawMany();

    return result.map((r) => r.id);
  }

  /**
   * Get all user IDs that have access to a bucket (owner + users with permissions)
   */
  async getBucketAuthorizedUserIds(
    bucketId: string,
    requesterId?: string,
  ): Promise<string[]> {
    // Get bucket with owner information
    const bucketRepository =
      this.entityPermissionRepository.manager.getRepository('Bucket');
    const bucket = await bucketRepository.findOne({
      where: { id: bucketId },
      relations: ['user'],
    });

    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    const userIds = new Set<string>();

    // Add bucket owner
    userIds.add(bucket.user.id);

    // Special case: If this is an admin bucket, all admins have access
    if (bucket.isAdmin) {
      const adminUsers = await this.userRepository.find({
        where: { role: UserRole.ADMIN },
      });
      adminUsers.forEach((admin) => userIds.add(admin.id));
      // this.logger.debug(
      //   `Admin bucket ${bucketId}: Added ${adminUsers.length} admins as authorized users`,
      // );
    }

    // Get all permissions for this bucket to find users with access
    const permissions = await this.entityPermissionRepository.find({
      where: {
        resourceType: ResourceType.BUCKET,
        resourceId: bucketId,
      },
      relations: ['user'],
    });

    // Add all users who have permissions on this bucket
    permissions.forEach((permission) => {
      userIds.add(permission.user.id);
    });

    return Array.from(userIds);
  }

  /**
   * Find a specific permission record
   */
  async findPermission(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<EntityPermission | null> {
    return this.entityPermissionRepository.findOne({
      where: {
        user: { id: userId },
        resourceType,
        resourceId,
      },
    });
  }

  /**
   * Save a permission record
   */
  async savePermission(permission: EntityPermission): Promise<EntityPermission> {
    return this.entityPermissionRepository.save(permission);
  }
}
