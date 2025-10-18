import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';
import { Repository, In } from 'typeorm';
import { Bucket } from '../entities/bucket.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { User } from '../entities/user.entity';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { UrlBuilderService } from '../common/services/url-builder.service';
import { UserRole } from '../users/users.types';
import { CreateBucketDto, UpdateBucketDto } from './dto/index';

@Injectable()
export class BucketsService {
  private readonly logger = new Logger(BucketsService.name);

  constructor(
    @InjectRepository(Bucket)
    private readonly bucketsRepository: Repository<Bucket>,
    @InjectRepository(UserBucket)
    private readonly userBucketRepository: Repository<UserBucket>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly entityPermissionService: EntityPermissionService,
    private readonly eventTrackingService: EventTrackingService,
    private readonly attachmentsService: AttachmentsService,
    private readonly urlBuilderService: UrlBuilderService,
  ) {}

  async create(
    userId: string,
    createBucketDto: CreateBucketDto,
  ): Promise<Bucket> {
    const bucket = this.bucketsRepository.create({
      ...createBucketDto,
      user: { id: userId },
    });

    // Save then reload with relations to ensure User fields (e.g. email)
    // are populated before returning to the GraphQL layer.
    const saved = await this.bucketsRepository.save(bucket);
    
    // Generate bucket icon automatically (only if attachments are enabled)
    const attachmentsEnabled = await this.attachmentsService.isAttachmentsEnabled();
    if (attachmentsEnabled) {
      try {
        const attachment = await this.attachmentsService.generateAndSaveBucketIcon(
          userId,
          saved.id,
          saved.name,
          saved.color || '#007AFF',
          saved.icon,
          createBucketDto.generateIconWithInitials ?? true,
        );
        
        // Update bucket with generated icon URL
        const iconUrl = this.urlBuilderService.buildAttachmentUrl(attachment.id);
        await this.bucketsRepository.update(saved.id, { icon: iconUrl });
        saved.icon = iconUrl;
      } catch (error) {
        this.logger.error(`Failed to generate icon for bucket ${saved.name}`, error.stack);
        // Don't fail bucket creation if icon generation fails
      }
    }

    const reloaded = await this.bucketsRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    // Create UserBucket relationship immediately to optimize future snooze operations
    try {
      await this.createUserBucket(userId, { bucketId: saved.id });
    } catch (error) {}

    return reloaded ?? saved;
  }

  async findAll(userId: string): Promise<Bucket[]> {
    // Get owned buckets with userBucket relation
    const ownedBuckets = await this.bucketsRepository.find({
      where: { user: { id: userId } },
      relations: ['messages', 'messages.bucket', 'user', 'userBuckets'],
      order: { createdAt: 'DESC' },
    });

    // Get shared buckets through entity permissions
    const sharedBuckets = await this.bucketsRepository
      .createQueryBuilder('bucket')
      .leftJoinAndSelect('bucket.messages', 'messages')
      .leftJoinAndSelect('messages.bucket', 'messageBucket')
      .leftJoinAndSelect('bucket.user', 'user')
      .leftJoinAndSelect(
        'bucket.userBuckets',
        'userBuckets',
        'userBuckets.userId = :userId',
        { userId },
      )
      .innerJoin(
        'entity_permissions',
        'ep',
        'ep.resourceType = :resourceType AND ep.resourceId = bucket.id AND ep.userId = :userId',
        { resourceType: ResourceType.BUCKET, userId },
      )
      .where('bucket.userId != :userId', { userId })
      .orderBy('bucket.createdAt', 'DESC')
      .getMany();

    // Get public buckets
    const publicBuckets = await this.bucketsRepository.find({
      where: { isPublic: true },
      relations: ['messages', 'messages.bucket', 'user', 'userBuckets'],
      order: { createdAt: 'DESC' },
    });

    // Get admin buckets if user is admin
    let adminBuckets: Bucket[] = [];
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (user && user.role === UserRole.ADMIN) {
      adminBuckets = await this.bucketsRepository.find({
        where: { isAdmin: true },
        relations: ['messages', 'messages.bucket', 'user', 'userBuckets'],
        order: { createdAt: 'DESC' },
      });
    }

    // Combine and remove duplicates
    const allBuckets = [
      ...ownedBuckets,
      ...sharedBuckets,
      ...publicBuckets,
      ...adminBuckets,
    ];
    const uniqueBuckets = allBuckets.filter(
      (bucket, index, self) =>
        index === self.findIndex((b) => b.id === bucket.id),
    );

    // Add userBucket field for current user to each bucket
    const bucketsWithUserBucket = uniqueBuckets.map((bucket) => {
      const userBucket = bucket.userBuckets?.find((ub) => ub.userId === userId);
      return {
        ...bucket,
        userBucket: userBucket || undefined,
      };
    });

    const sortedBuckets = bucketsWithUserBucket.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return sortedBuckets;
  }

  async findOne(id: string, userId: string): Promise<Bucket> {
    // Load bucket with owner and messages
    const baseBucket = await this.bucketsRepository.findOne({
      where: { id },
      relations: ['messages', 'messages.bucket', 'user'],
    });

    if (!baseBucket) {
      throw new NotFoundException('Bucket not found');
    }

    // Check if user owns the bucket or has read permissions
    const isOwner = baseBucket.user.id === userId;
    
    // Check if it's an admin bucket and user is admin
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    const isAdminAccessingAdminBucket = 
      baseBucket.isAdmin && user && user.role === UserRole.ADMIN;

    if (!isOwner && !isAdminAccessingAdminBucket) {
      const hasPermission = await this.entityPermissionService.hasPermissions(
        userId,
        ResourceType.BUCKET,
        id,
        [Permission.READ],
      );

      if (!hasPermission) {
        throw new ForbiddenException('You do not have access to this bucket');
      }
    }

    // Eager-load current user's UserBucket for this bucket (best effort, tolerant to mocks)
    try {
      const qb: any = this.bucketsRepository.createQueryBuilder?.('bucket');
      if (
        qb &&
        typeof qb.leftJoinAndSelect === 'function' &&
        typeof qb.where === 'function' &&
        typeof qb.getOne === 'function'
      ) {
        const withUserBuckets = await qb
          .leftJoinAndSelect(
            'bucket.userBuckets',
            'userBuckets',
            'userBuckets.userId = :userId',
            { userId },
          )
          .where('bucket.id = :id', { id })
          .getOne();
        if (withUserBuckets) {
          const userBucket = (withUserBuckets.userBuckets || []).find(
            (ub: any) => ub.userId === userId,
          );
          (baseBucket as any).userBucket = userBucket || undefined;
        }
      }
    } catch {}

    return baseBucket;
  }

  async update(
    id: string,
    userId: string,
    updateBucketDto: UpdateBucketDto,
  ): Promise<Bucket> {
    const bucket = await this.bucketsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    // Check if user owns the bucket or has admin permissions
    const isOwner = bucket.user.id === userId;
    if (!isOwner) {
      const hasPermission = await this.entityPermissionService.hasPermissions(
        userId,
        ResourceType.BUCKET,
        id,
        [Permission.ADMIN],
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'You do not have admin access to this bucket',
        );
      }
    }

    // Prevent updating protected buckets unless user is owner
    if (bucket.isProtected && !isOwner) {
      throw new ForbiddenException(
        'Cannot update a protected bucket without owner permissions',
      );
    }

    // Check if properties that affect icon generation have changed
    const needsIconRegeneration = 
      updateBucketDto.name !== undefined && updateBucketDto.name !== bucket.name ||
      updateBucketDto.color !== undefined && updateBucketDto.color !== bucket.color ||
      updateBucketDto.icon !== undefined && updateBucketDto.icon !== bucket.icon;

    // Update basic bucket properties
    Object.assign(bucket, updateBucketDto);

    // Save bucket
    const saved = await this.bucketsRepository.save(bucket);

    // Regenerate icon if needed (only if attachments are enabled)
    const attachmentsEnabled = await this.attachmentsService.isAttachmentsEnabled();
    if (needsIconRegeneration && attachmentsEnabled) {
      try {
        const attachment = await this.attachmentsService.generateAndSaveBucketIcon(
          userId,
          saved.id,
          saved.name,
          saved.color || '#007AFF',
          saved.icon,
          updateBucketDto.generateIconWithInitials ?? true,
        );
        
        // Update bucket with new icon URL
        const iconUrl = this.urlBuilderService.buildAttachmentUrl(attachment.id);
        await this.bucketsRepository.update(saved.id, { icon: iconUrl });
        saved.icon = iconUrl;
      } catch (error) {
        this.logger.error(`Failed to regenerate icon for bucket ${saved.name}`, error.stack);
        // Don't fail bucket update if icon generation fails
      }
    }

    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    const bucket = await this.bucketsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    // Check if bucket is protected
    if (bucket.isProtected) {
      throw new ForbiddenException('Cannot delete a protected bucket');
    }

    // Check if user owns the bucket or has delete permissions
    const isOwner = bucket.user.id === userId;
    if (!isOwner) {
      const hasPermission = await this.entityPermissionService.hasPermissions(
        userId,
        ResourceType.BUCKET,
        id,
        [Permission.DELETE],
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'You do not have delete access to this bucket',
        );
      }
    }

    // Permanent delete the bucket
    await this.bucketsRepository.remove(bucket);
  }

  async getNotificationsCount(
    bucketId: string,
    userId: string,
  ): Promise<number> {
    await this.findOne(bucketId, userId);

    return this.bucketsRepository
      .createQueryBuilder('bucket')
      .leftJoinAndSelect('bucket.messages', 'message')
      .where('bucket.id = :bucketId', { bucketId })
      .getCount();
  }

  async createUserBucket(
    userId: string,
    params: {
      bucketId: string;
      snoozeUntil?: string | undefined;
      snoozes?: any[];
    },
  ): Promise<UserBucket> {
    const existing = await this.userBucketRepository.findOne({
      where: { userId, bucketId: params.bucketId },
    });
    if (existing) {
      throw new ConflictException('User bucket relationship already exists');
    }

    const userBucket = this.userBucketRepository.create({
      bucketId: params.bucketId,
      userId,
      snoozeUntil: params.snoozeUntil
        ? new Date(params.snoozeUntil)
        : undefined,
      snoozes: params.snoozes || [],
    });
    const savedUserBucket = await this.userBucketRepository.save(userBucket);
    return savedUserBucket;
  }

  async findUserBucketByBucketAndUser(
    bucketId: string,
    userId: string,
  ): Promise<UserBucket | null> {
    const result = await this.userBucketRepository.findOne({
      where: { bucketId, userId },
      relations: ['bucket'],
    });
    return result;
  }

  async findUserBucketsByUser(userId: string): Promise<UserBucket[]> {
    const result = await this.userBucketRepository.find({
      where: { userId },
      relations: ['bucket'],
    });
    return result;
  }

  async findUserBucketsByBucketAndUsers(
    bucketId: string,
    userIds: string[],
  ): Promise<UserBucket[]> {
    if (userIds.length === 0) return [];
    return this.userBucketRepository.find({
      where: { bucketId, userId: In(userIds) },
      relations: ['bucket'],
    });
  }

  async findOrCreateUserBucket(
    bucketId: string,
    userId: string,
  ): Promise<UserBucket> {
    // First try to find existing UserBucket
    let userBucket = await this.findUserBucketByBucketAndUser(bucketId, userId);
    if (!userBucket) {
      try {
        userBucket = await this.createUserBucket(userId, { bucketId });
      } catch (error) {
        // If creation fails due to race condition, try to find again
        if (error instanceof ConflictException) {
          userBucket = await this.findUserBucketByBucketAndUser(
            bucketId,
            userId,
          );
          if (!userBucket) {
            throw error; // Re-throw if still not found
          }
        } else {
          throw error;
        }
      }
    }
    return userBucket;
  }

  async isBucketSnoozedFromData(
    bucketId: string,
    userId: string,
    userBuckets: UserBucket[],
  ): Promise<boolean> {
    const userBucket = userBuckets.find((ub) => ub.bucketId === bucketId);
    const result =
      userBucket && userBucket.snoozeUntil
        ? new Date() < userBucket.snoozeUntil
        : false;
    return result;
  }

  async isBucketSnoozed(bucketId: string, userId: string): Promise<boolean> {
    const userBucket = await this.findUserBucketByBucketAndUser(
      bucketId,
      userId,
    );
    const result =
      userBucket && userBucket.snoozeUntil
        ? new Date() < userBucket.snoozeUntil
        : false;
    return result;
  }

  async setBucketSnooze(
    bucketId: string,
    userId: string,
    snoozeUntil: string | null,
  ): Promise<UserBucket | null> {
    if (snoozeUntil === null) {
      const existing = await this.findUserBucketByBucketAndUser(
        bucketId,
        userId,
      );
      if (existing) {
        existing.snoozeUntil = null;
        const result = await this.userBucketRepository.save(existing);
        return result;
      }
      const result = await this.createUserBucket(userId, { bucketId });
      return result;
    }

    const userBucket = await this.findOrCreateUserBucket(bucketId, userId);
    userBucket.snoozeUntil = new Date(snoozeUntil);
    const result = await this.userBucketRepository.save(userBucket);
    return result;
  }

  async setBucketSnoozeMinutes(
    bucketId: string,
    userId: string,
    minutes: number,
  ): Promise<UserBucket | null> {
    // Calculate snooze until date (now + minutes)
    const snoozeUntil = new Date();
    snoozeUntil.setMinutes(snoozeUntil.getMinutes() + minutes);

    const userBucket = await this.findOrCreateUserBucket(bucketId, userId);
    userBucket.snoozeUntil = snoozeUntil;
    const result = await this.userBucketRepository.save(userBucket);
    return result;
  }

  async updateBucketSnoozes(
    bucketId: string,
    userId: string,
    snoozes: any[],
  ): Promise<UserBucket> {
    const userBucket = await this.findOrCreateUserBucket(bucketId, userId);
    userBucket.snoozes = snoozes || [];
    return this.userBucketRepository.save(userBucket);
  }

  async removeUserBucket(bucketId: string, userId: string): Promise<void> {
    const userBucket = await this.findUserBucketByBucketAndUser(
      bucketId,
      userId,
    );
    if (userBucket) {
      // Get bucket owner to track the unsharing event correctly
      const bucket = await this.bucketsRepository.findOne({
        where: { id: bucketId },
        relations: ['user'],
      });

      if (bucket) {
        // Track as owner removing access from user (even if user is removing themselves)
        await this.eventTrackingService.trackBucketUnsharing(
          bucket.user.id, // owner
          bucketId, // bucket
          userId, // user being removed
        );
      }

      await this.userBucketRepository.remove(userBucket);
    }
  }
}
