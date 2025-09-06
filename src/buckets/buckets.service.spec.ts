import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';
import { Repository } from 'typeorm';
import { Bucket } from '../entities/bucket.entity';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { BucketsService } from './buckets.service';
import { CreateBucketDto, UpdateBucketDto } from './dto';

describe('BucketsService', () => {
  let service: BucketsService;
  let bucketsRepository: Repository<Bucket>;
  let entityPermissionService: EntityPermissionService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
  };

  const mockBucket: Partial<Bucket> = {
    id: 'bucket-1',
    name: 'Test Bucket',
    icon: 'bucket-icon.png',
    isProtected: false,
    isPublic: false,
    user: mockUser as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
  };

  const mockCreateBucketDto: CreateBucketDto = {
    name: 'Test Bucket',
    icon: 'bucket-icon.png',
  };

  const mockCreateBucketDtoWithEmoji: CreateBucketDto = {
    name: 'Emoji Bucket',
    icon: '🚀',
  };

  const mockCreateBucketDtoWithDataUrl: CreateBucketDto = {
    name: 'Data URL Bucket',
    icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };

  const mockUpdateBucketDto: UpdateBucketDto = {
    name: 'Updated Bucket',
    icon: 'updated-icon.png',
    description: 'Updated Description',
    color: '#FF0000',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BucketsService,
        {
          provide: getRepositoryToken(Bucket),
          useValue: {
            create: jest.fn().mockReturnValue(mockBucket),
            save: jest.fn().mockResolvedValue(mockBucket),
            find: jest.fn().mockResolvedValue([mockBucket]),
            findOne: jest.fn().mockResolvedValue(mockBucket),
            remove: jest.fn().mockResolvedValue(undefined),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
              getCount: jest.fn().mockResolvedValue(0),
            })),
          },
        },
        {
          provide: EntityPermissionService,
          useValue: {
            hasPermissions: jest.fn().mockResolvedValue(true),
            checkPermission: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<BucketsService>(BucketsService);
    bucketsRepository = module.get<Repository<Bucket>>(
      getRepositoryToken(Bucket),
    );
    entityPermissionService = module.get<EntityPermissionService>(
      EntityPermissionService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a bucket successfully', async () => {
      const result = await service.create('user-1', mockCreateBucketDto);

      expect(bucketsRepository.create).toHaveBeenCalledWith({
        ...mockCreateBucketDto,
        user: { id: 'user-1' },
      });
      expect(bucketsRepository.save).toHaveBeenCalled();
      expect(bucketsRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockBucket.id },
        relations: ['user'],
      });
      expect(result).toEqual(mockBucket);
    });

    it('should create a bucket with emoji icon successfully', async () => {
      const result = await service.create('user-1', mockCreateBucketDtoWithEmoji);

      expect(bucketsRepository.create).toHaveBeenCalledWith({
        ...mockCreateBucketDtoWithEmoji,
        user: { id: 'user-1' },
      });
      expect(bucketsRepository.save).toHaveBeenCalled();
      expect(bucketsRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockBucket.id },
        relations: ['user'],
      });
      expect(result).toEqual(mockBucket);
    });

    it('should create a bucket with data URL icon successfully', async () => {
      const result = await service.create('user-1', mockCreateBucketDtoWithDataUrl);

      expect(bucketsRepository.create).toHaveBeenCalledWith({
        ...mockCreateBucketDtoWithDataUrl,
        user: { id: 'user-1' },
      });
      expect(bucketsRepository.save).toHaveBeenCalled();
      expect(bucketsRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockBucket.id },
        relations: ['user'],
      });
      expect(result).toEqual(mockBucket);
    });
  });

  describe('findAll', () => {
    it('should return owned buckets for user', async () => {
      const result = await service.findAll('user-1');

      expect(bucketsRepository.find).toHaveBeenCalledWith({
        where: { user: { id: 'user-1' } },
        relations: ['messages', 'messages.bucket', 'user'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockBucket]);
    });

    it('should include shared buckets through entity permissions', async () => {
      const mockSharedBucket = {
        ...mockBucket,
        id: 'bucket-2',
        user: { ...mockUser, id: 'user-2' } as any,
      };
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSharedBucket]),
      };

      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll('user-1');

      expect(bucketsRepository.createQueryBuilder).toHaveBeenCalledWith(
        'bucket',
      );
      expect(result).toEqual([mockBucket, mockSharedBucket]);
    });
  });

  describe('findOne', () => {
    it('should return bucket when user owns it', async () => {
      const result = await service.findOne('bucket-1', 'user-1');

      expect(bucketsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'bucket-1' },
        relations: ['messages', 'messages.bucket', 'user'],
      });
      expect(result).toEqual(mockBucket);
    });

    it('should return bucket when user has read permissions', async () => {
      const mockSharedBucket = {
        ...mockBucket,
        user: { ...mockUser, id: 'user-2' } as any,
      };
      jest
        .spyOn(bucketsRepository, 'findOne')
        .mockResolvedValue(mockSharedBucket as any);

      const result = await service.findOne('bucket-1', 'user-1');

      expect(entityPermissionService.hasPermissions).toHaveBeenCalledWith(
        'user-1',
        ResourceType.BUCKET,
        'bucket-1',
        [Permission.READ],
      );
      expect(result).toEqual(mockSharedBucket);
    });

    it('should throw NotFoundException when bucket not found', async () => {
      jest.spyOn(bucketsRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user has no access', async () => {
      const mockSharedBucket = {
        ...mockBucket,
        user: { ...mockUser, id: 'user-2' } as any,
      };
      jest
        .spyOn(bucketsRepository, 'findOne')
        .mockResolvedValue(mockSharedBucket as any);
      jest
        .spyOn(entityPermissionService, 'hasPermissions')
        .mockResolvedValue(false);

      await expect(service.findOne('bucket-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update bucket when user owns it', async () => {
      const result = await service.update(
        'bucket-1',
        'user-1',
        mockUpdateBucketDto,
      );

      expect(bucketsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'bucket-1' },
        relations: ['user'],
      });
      expect(bucketsRepository.save).toHaveBeenCalledWith({
        ...mockBucket,
        ...mockUpdateBucketDto,
      });
      expect(result).toEqual(mockBucket);
    });

    it('should update bucket when user has admin permissions', async () => {
      const mockSharedBucket = {
        ...mockBucket,
        user: { ...mockUser, id: 'user-2' } as any,
      };
      jest
        .spyOn(bucketsRepository, 'findOne')
        .mockResolvedValue(mockSharedBucket as any);

      const result = await service.update(
        'bucket-1',
        'user-1',
        mockUpdateBucketDto,
      );

      expect(entityPermissionService.hasPermissions).toHaveBeenCalledWith(
        'user-1',
        ResourceType.BUCKET,
        'bucket-1',
        [Permission.ADMIN],
      );
      expect(result).toEqual(mockBucket);
    });

    it('should throw NotFoundException when bucket not found', async () => {
      jest.spyOn(bucketsRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user-1', mockUpdateBucketDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user has no access', async () => {
      const mockSharedBucket = {
        ...mockBucket,
        user: { ...mockUser, id: 'user-2' } as any,
      };
      jest
        .spyOn(bucketsRepository, 'findOne')
        .mockResolvedValue(mockSharedBucket as any);
      jest
        .spyOn(entityPermissionService, 'hasPermissions')
        .mockResolvedValue(false);

      await expect(
        service.update('bucket-1', 'user-1', mockUpdateBucketDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when updating protected bucket without owner permissions', async () => {
      const protectedBucket = { ...mockBucket, isProtected: true };
      jest
        .spyOn(bucketsRepository, 'findOne')
        .mockResolvedValue(protectedBucket as Bucket);

      await expect(
        service.update('bucket-1', 'user-2', mockUpdateBucketDto),
      ).rejects.toThrow(ForbiddenException);
      expect(bucketsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove bucket when user owns it', async () => {
      await service.remove('bucket-1', 'user-1');

      expect(bucketsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'bucket-1' },
        relations: ['user'],
      });
      expect(bucketsRepository.remove).toHaveBeenCalledWith(mockBucket);
    });

    it('should remove bucket when user has delete permissions', async () => {
      const mockSharedBucket = {
        ...mockBucket,
        user: { ...mockUser, id: 'user-2' } as any,
      };
      jest
        .spyOn(bucketsRepository, 'findOne')
        .mockResolvedValue(mockSharedBucket as any);

      await service.remove('bucket-1', 'user-1');

      expect(entityPermissionService.hasPermissions).toHaveBeenCalledWith(
        'user-1',
        ResourceType.BUCKET,
        'bucket-1',
        [Permission.DELETE],
      );
      expect(bucketsRepository.remove).toHaveBeenCalledWith(mockSharedBucket);
    });

    it('should throw NotFoundException when bucket not found', async () => {
      jest.spyOn(bucketsRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user has no access', async () => {
      const mockSharedBucket = {
        ...mockBucket,
        user: { ...mockUser, id: 'user-2' } as any,
      };
      jest
        .spyOn(bucketsRepository, 'findOne')
        .mockResolvedValue(mockSharedBucket as any);
      jest
        .spyOn(entityPermissionService, 'hasPermissions')
        .mockResolvedValue(false);

      await expect(service.remove('bucket-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if bucket is protected', async () => {
      const protectedBucket = { ...mockBucket, isProtected: true };
      jest
        .spyOn(bucketsRepository, 'findOne')
        .mockResolvedValue(protectedBucket as Bucket);

      await expect(service.remove('bucket-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(bucketsRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('getNotificationsCount', () => {
    it('should return notification count for bucket', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      };

      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getNotificationsCount('bucket-1', 'user-1');

      expect(bucketsRepository.createQueryBuilder).toHaveBeenCalledWith(
        'bucket',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'bucket.messages',
        'message',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'bucket.id = :bucketId',
        { bucketId: 'bucket-1' },
      );
      expect(mockQueryBuilder.getCount).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should handle bucket not found', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new NotFoundException('Bucket not found'));

      await expect(
        service.getNotificationsCount('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle forbidden access', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(
          new ForbiddenException('You do not have access to this bucket'),
        );

      await expect(
        service.getNotificationsCount('bucket-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getBucketMessages', () => {
    it('should return bucket messages with pagination', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(10),
      };

      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getBucketMessages('bucket-1', 'user-1', {
        page: 2,
        limit: 5,
      });

      expect(bucketsRepository.createQueryBuilder).toHaveBeenCalledWith(
        'bucket',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'bucket.messages',
        'message',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'bucket.id = :bucketId',
        { bucketId: 'bucket-1' },
      );
      expect(mockQueryBuilder.getCount).toHaveBeenCalled();
      expect(result).toEqual({
        messages: [],
        total: 10,
        page: 2,
        limit: 5,
      });
    });

    it('should use default pagination values when not provided', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };

      jest
        .spyOn(bucketsRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getBucketMessages('bucket-1', 'user-1');

      expect(result).toEqual({
        messages: [],
        total: 0,
        page: 1,
        limit: 20,
      });
    });

    it('should throw ForbiddenException when user has no access', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new ForbiddenException('Access denied'));

      await expect(
        service.getBucketMessages('bucket-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(service.findOne).toHaveBeenCalledWith('bucket-1', 'user-1');
    });
  });
});
