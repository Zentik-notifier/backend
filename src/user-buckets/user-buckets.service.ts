import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserBucket } from '../entities/user-bucket.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import {
  CreateUserBucketDto,
  SnoozeScheduleInput,
  UpdateUserBucketDto,
} from './dto';

@Injectable()
export class UserBucketsService {
  constructor(
    @InjectRepository(UserBucket)
    private readonly userBucketRepository: Repository<UserBucket>,
    private readonly eventTrackingService: EventTrackingService,
  ) {}

  async create(
    userId: string,
    createUserBucketDto: CreateUserBucketDto,
  ): Promise<UserBucket> {
    // Check if user-bucket relationship already exists
    const existing = await this.userBucketRepository.findOne({
      where: { userId, bucketId: createUserBucketDto.bucketId },
    });

    if (existing) {
      throw new ConflictException('User bucket relationship already exists');
    }

    const userBucket = this.userBucketRepository.create({
      ...createUserBucketDto,
      userId,
      snoozeUntil: createUserBucketDto.snoozeUntil
        ? new Date(createUserBucketDto.snoozeUntil)
        : undefined,
      snoozes: createUserBucketDto.snoozes || [],
    });

    const savedUserBucket = await this.userBucketRepository.save(userBucket);

    // Track bucket sharing event
    await this.eventTrackingService.trackBucketSharing(
      userId,
      createUserBucketDto.bucketId,
    );

    return savedUserBucket;
  }

  async findAllByUser(userId: string): Promise<UserBucket[]> {
    return this.userBucketRepository.find({
      where: { userId },
      relations: ['bucket'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<UserBucket> {
    const userBucket = await this.userBucketRepository.findOne({
      where: { id, userId },
      relations: ['bucket'],
    });

    if (!userBucket) {
      throw new NotFoundException('User bucket not found');
    }

    return userBucket;
  }

  async findByBucketAndUser(
    bucketId: string,
    userId: string,
  ): Promise<UserBucket | null> {
    return this.userBucketRepository.findOne({
      where: { bucketId, userId },
      relations: ['bucket'],
    });
  }

  async findByBucketAndUsers(
    bucketId: string,
    userIds: string[],
  ): Promise<UserBucket[]> {
    if (userIds.length === 0) {
      return [];
    }

    return this.userBucketRepository.find({
      where: { bucketId, userId: In(userIds) },
      relations: ['bucket'],
    });
  }

  async findOrCreateByBucketAndUser(
    bucketId: string,
    userId: string,
  ): Promise<UserBucket> {
    let userBucket = await this.findByBucketAndUser(bucketId, userId);

    if (!userBucket) {
      // Create a new user-bucket relationship if it doesn't exist
      userBucket = await this.create(userId, {
        bucketId,
        snoozeUntil: undefined,
        snoozes: [],
      });
    }

    return userBucket;
  }

  async update(
    id: string,
    userId: string,
    updateUserBucketDto: UpdateUserBucketDto,
  ): Promise<UserBucket> {
    const userBucket = await this.findOne(id, userId);

    // Update snoozeUntil if provided (string ISO -> Date, or null to clear)
    if ('snoozeUntil' in updateUserBucketDto) {
      const value = updateUserBucketDto.snoozeUntil;
      if (value === null) {
        userBucket.snoozeUntil = null;
      } else if (typeof value === 'string') {
        userBucket.snoozeUntil = new Date(value);
      }
    }

    // Update snoozes if provided
    if ('snoozes' in updateUserBucketDto) {
      userBucket.snoozes = updateUserBucketDto.snoozes ?? [];
    }

    // Allow updating bucketId if provided
    if (updateUserBucketDto.bucketId) {
      userBucket.bucketId = updateUserBucketDto.bucketId;
    }

    return this.userBucketRepository.save(userBucket);
  }

  async remove(id: string, userId: string): Promise<void> {
    const userBucket = await this.findOne(id, userId);

    // Track bucket unsharing event before removal
    await this.eventTrackingService.trackBucketUnsharing(
      userId,
      userBucket.bucketId,
    );

    await this.userBucketRepository.remove(userBucket);
  }

  async removeByBucketAndUser(bucketId: string, userId: string): Promise<void> {
    const userBucket = await this.findByBucketAndUser(bucketId, userId);
    if (userBucket) {
      // Track bucket unsharing event before removal
      await this.eventTrackingService.trackBucketUnsharing(userId, bucketId);

      await this.userBucketRepository.remove(userBucket);
    }
  }

  async isSnoozed(bucketId: string, userId: string): Promise<boolean> {
    const userBucket = await this.findByBucketAndUser(bucketId, userId);
    if (!userBucket || !userBucket.snoozeUntil) {
      return false;
    }
    return new Date() < userBucket.snoozeUntil;
  }

  async setBucketSnooze(
    bucketId: string,
    userId: string,
    snoozeUntil: string | null,
  ): Promise<UserBucket | null> {
    if (snoozeUntil === null) {
      // Unset snooze but keep the relation so GraphQL non-null return type is satisfied
      const existing = await this.findByBucketAndUser(bucketId, userId);
      if (existing) {
        return this.update(existing.id, userId, { snoozeUntil: null as any });
      }
      // Create relation without snooze
      return this.create(userId, { bucketId, snoozeUntil: undefined });
    }

    // Use findOrCreate to ensure the relationship exists
    const userBucket = await this.findOrCreateByBucketAndUser(bucketId, userId);
    return this.update(userBucket.id, userId, { snoozeUntil });
  }

  async updateBucketSnoozes(
    bucketId: string,
    userId: string,
    snoozes: SnoozeScheduleInput[],
  ): Promise<UserBucket> {
    const userBucket = await this.findOrCreateByBucketAndUser(bucketId, userId);
    return this.update(userBucket.id, userId, { snoozes });
  }

  async getSnoozedBucketIds(userId: string): Promise<string[]> {
    const userBuckets = await this.findAllByUser(userId);
    const snoozedBuckets = userBuckets.filter(
      (ub) => ub.snoozeUntil && new Date() < ub.snoozeUntil,
    );
    return snoozedBuckets.map((ub) => ub.bucketId);
  }
}
