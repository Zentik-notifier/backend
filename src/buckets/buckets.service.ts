import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';
import { Repository, In } from 'typeorm';
import { Bucket } from '../entities/bucket.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { CreateBucketDto, UpdateBucketDto } from './dto/index';

@Injectable()
export class BucketsService {
  constructor(
    @InjectRepository(Bucket)
    private readonly bucketsRepository: Repository<Bucket>,
    @InjectRepository(UserBucket)
    private readonly userBucketRepository: Repository<UserBucket>,
    private readonly entityPermissionService: EntityPermissionService,
    private readonly eventTrackingService: EventTrackingService,
  ) { }

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
    const reloaded = await this.bucketsRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    return reloaded ?? saved;
  }

  async findAll(userId: string): Promise<Bucket[]> {
    // Get owned buckets
    const ownedBuckets = await this.bucketsRepository.find({
      where: { user: { id: userId } },
      relations: ['messages', 'messages.bucket', 'user'],
      order: { createdAt: 'DESC' },
    });

    // Get shared buckets through entity permissions
    const sharedBuckets = await this.bucketsRepository
      .createQueryBuilder('bucket')
      .leftJoinAndSelect('bucket.messages', 'messages')
      .leftJoinAndSelect('messages.bucket', 'messageBucket')
      .leftJoinAndSelect('bucket.user', 'user')
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
      relations: ['messages', 'messages.bucket', 'user'],
      order: { createdAt: 'DESC' },
    });

    // Combine and remove duplicates
    const allBuckets = [...ownedBuckets, ...sharedBuckets, ...publicBuckets];
    const uniqueBuckets = allBuckets.filter(
      (bucket, index, self) =>
        index === self.findIndex((b) => b.id === bucket.id),
    );

    return uniqueBuckets.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async findOne(id: string, userId: string): Promise<Bucket> {
    const bucket = await this.bucketsRepository.findOne({
      where: { id },
      relations: ['messages', 'messages.bucket', 'user'],
    });

    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    // Check if user owns the bucket or has read permissions
    const isOwner = bucket.user.id === userId;
    if (!isOwner) {
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

    return bucket;
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

    // Update basic bucket properties
    Object.assign(bucket, updateBucketDto);

    // devices support removed

    return this.bucketsRepository.save(bucket);
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
    params: { bucketId: string; snoozeUntil?: string | undefined; snoozes?: any[] },
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
      snoozeUntil: params.snoozeUntil ? new Date(params.snoozeUntil) : undefined,
      snoozes: params.snoozes || [],
    });
    const savedUserBucket = await this.userBucketRepository.save(userBucket);
    return savedUserBucket;
  }

  async findUserBucketByBucketAndUser(
    bucketId: string,
    userId: string,
  ): Promise<UserBucket | null> {
    return this.userBucketRepository.findOne({
      where: { bucketId, userId },
      relations: ['bucket'],
    });
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
    let userBucket = await this.findUserBucketByBucketAndUser(bucketId, userId);
    if (!userBucket) {
      userBucket = await this.createUserBucket(userId, { bucketId });
    }
    return userBucket;
  }

  async isBucketSnoozed(bucketId: string, userId: string): Promise<boolean> {
    const userBucket = await this.findUserBucketByBucketAndUser(bucketId, userId);
    if (!userBucket || !userBucket.snoozeUntil) return false;
    return new Date() < userBucket.snoozeUntil;
  }

  async setBucketSnooze(
    bucketId: string,
    userId: string,
    snoozeUntil: string | null,
  ): Promise<UserBucket | null> {
    if (snoozeUntil === null) {
      const existing = await this.findUserBucketByBucketAndUser(bucketId, userId);
      if (existing) {
        existing.snoozeUntil = null;
        return this.userBucketRepository.save(existing);
      }
      return this.createUserBucket(userId, { bucketId });
    }
    const userBucket = await this.findOrCreateUserBucket(bucketId, userId);
    userBucket.snoozeUntil = new Date(snoozeUntil);
    return this.userBucketRepository.save(userBucket);
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
    return this.userBucketRepository.save(userBucket);
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
    const userBucket = await this.findUserBucketByBucketAndUser(bucketId, userId);
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
          bucketId,       // bucket
          userId          // user being removed
        );
      }
      
      await this.userBucketRepository.remove(userBucket);
    }
  }
}
