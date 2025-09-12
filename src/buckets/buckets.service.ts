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
import { AttachmentsService } from '../attachments/attachments.service';
import { MediaType } from 'src/notifications/notifications.types';

@Injectable()
export class BucketsService {
  constructor(
    @InjectRepository(Bucket)
    private readonly bucketsRepository: Repository<Bucket>,
    private readonly entityPermissionService: EntityPermissionService,
    private readonly attachmentsService: AttachmentsService,
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
    const bucket = await this.findOne(bucketId, userId);
    return this.bucketsRepository
      .createQueryBuilder('bucket')
      .leftJoinAndSelect('bucket.messages', 'message')
      .where('bucket.id = :bucketId', { bucketId })
      .getCount();
  }

  async getBucketMessages(
    bucketId: string,
    userId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
    } = {},
  ) {
    // First verify user has access to the bucket
    await this.findOne(bucketId, userId);

    // Then get messages using the messages service
    // We'll need to inject MessagesService or use a different approach
    // For now, we'll return a simple message count
    const messageCount = await this.bucketsRepository
      .createQueryBuilder('bucket')
      .leftJoinAndSelect('bucket.messages', 'message')
      .where('bucket.id = :bucketId', { bucketId })
      .getCount();

    // Return a simple object that matches the expected structure
    // The resolver will handle the conversion to DTO if needed
    return {
      messages: [],
      total: messageCount,
      page: options.page || 1,
      limit: options.limit || 20,
    };
  }

  async uploadIcon(
    id: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<Bucket> {
    // Find the bucket
    const bucket = await this.bucketsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    // Check permissions
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

    // Validate file type (only images allowed for icons)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed for bucket icons`,
      );
    }

    // Validate file size (max 2MB for icons)
    const maxFileSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxFileSize} bytes`,
      );
    }

    try {
      // Upload the file using attachments service
      const attachment = await this.attachmentsService.uploadAttachment(
        userId,
        {
          filename: `bucket-icon-${id}`,
          mediaType: MediaType.ICON,
        },
        file,
      );

      // Update bucket with the new icon URL
      bucket.icon = `/api/v1/attachments/${attachment.id}`;
      return this.bucketsRepository.save(bucket);
    } catch (error) {
      throw new BadRequestException(`Failed to upload icon: ${error.message}`);
    }
  }
}
