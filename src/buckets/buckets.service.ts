import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';
import { Repository } from 'typeorm';
import { Bucket } from '../entities/bucket.entity';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { CreateBucketDto, UpdateBucketDto } from './dto/index';

@Injectable()
export class BucketsService {
  constructor(
    @InjectRepository(Bucket)
    private readonly bucketsRepository: Repository<Bucket>,
    private readonly entityPermissionService: EntityPermissionService,
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
}
