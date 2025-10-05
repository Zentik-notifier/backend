import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Bucket } from '../entities/bucket.entity';
import { BucketsController } from './buckets.controller';
import { BucketsService } from './buckets.service';
import { CreateBucketDto, UpdateBucketDto } from './dto';

describe('BucketsController', () => {
  let controller: BucketsController;
  let bucketsService: BucketsService;

  const mockBucket: Partial<Bucket> = {
    id: 'bucket-1',
    name: 'Test Bucket',
    description: 'Test Description',
    icon: 'bucket-icon.png',
    color: '#FF0000',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
    } as any,
    messages: [],
  };

  const mockBucketsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getNotificationsCount: jest.fn(),
    setBucketSnoozeMinutes: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BucketsController],
      providers: [
        {
          provide: BucketsService,
          useValue: mockBucketsService,
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<BucketsController>(BucketsController);
    bucketsService = module.get<BucketsService>(BucketsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a bucket successfully', async () => {
      const createBucketDto: CreateBucketDto = {
        name: 'Test Bucket',
        description: 'Test Description',
        icon: 'bucket-icon.png',
        color: '#FF0000',
      };

      mockBucketsService.create.mockResolvedValue(mockBucket as Bucket);

      const result = await controller.create('user-1', createBucketDto);

      expect(result).toEqual(mockBucket);
      expect(bucketsService.create).toHaveBeenCalledWith(
        'user-1',
        createBucketDto,
      );
    });

    it('should handle service errors', async () => {
      const createBucketDto: CreateBucketDto = {
        name: 'Test Bucket',
        description: 'Test Description',
      };

      const error = new Error('Service error');
      mockBucketsService.create.mockRejectedValue(error);

      await expect(
        controller.create('user-1', createBucketDto),
      ).rejects.toThrow(error);
      expect(bucketsService.create).toHaveBeenCalledWith(
        'user-1',
        createBucketDto,
      );
    });
  });

  describe('findAll', () => {
    it('should return all buckets for user', async () => {
      const buckets = [mockBucket];
      mockBucketsService.findAll.mockResolvedValue(buckets as Bucket[]);

      const result = await controller.findAll('user-1');

      expect(result).toEqual(buckets);
      expect(bucketsService.findAll).toHaveBeenCalledWith('user-1');
    });

    it('should return empty array when no buckets exist', async () => {
      mockBucketsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll('user-1');

      expect(result).toEqual([]);
      expect(bucketsService.findAll).toHaveBeenCalledWith('user-1');
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockBucketsService.findAll.mockRejectedValue(error);

      await expect(controller.findAll('user-1')).rejects.toThrow(error);
      expect(bucketsService.findAll).toHaveBeenCalledWith('user-1');
    });
  });

  describe('findOne', () => {
    it('should return a bucket by ID', async () => {
      mockBucketsService.findOne.mockResolvedValue(mockBucket as Bucket);

      const result = await controller.findOne('bucket-1', 'user-1');

      expect(result).toEqual(mockBucket);
      expect(bucketsService.findOne).toHaveBeenCalledWith('bucket-1', 'user-1');
    });

    it('should handle bucket not found', async () => {
      const error = new NotFoundException('Bucket not found');
      mockBucketsService.findOne.mockRejectedValue(error);

      await expect(controller.findOne('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(bucketsService.findOne).toHaveBeenCalledWith(
        'nonexistent',
        'user-1',
      );
    });

    it('should handle forbidden access', async () => {
      const error = new ForbiddenException(
        'You do not have access to this bucket',
      );
      mockBucketsService.findOne.mockRejectedValue(error);

      await expect(controller.findOne('bucket-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(bucketsService.findOne).toHaveBeenCalledWith('bucket-1', 'user-2');
    });
  });

  describe('update', () => {
    it('should update a bucket successfully', async () => {
      const updateBucketDto: UpdateBucketDto = {
        name: 'Updated Bucket',
        description: 'Updated Description',
        icon: 'updated-icon.png',
        color: '#FF0000',
      };
      const updatedBucket = { ...mockBucket, ...updateBucketDto };

      mockBucketsService.update.mockResolvedValue(updatedBucket as Bucket);

      const result = await controller.update(
        'bucket-1',
        'user-1',
        updateBucketDto,
      );

      expect(result).toEqual(updatedBucket);
      expect(bucketsService.update).toHaveBeenCalledWith(
        'bucket-1',
        'user-1',
        updateBucketDto,
      );
    });

    it('should handle bucket not found during update', async () => {
      const updateBucketDto: UpdateBucketDto = {
        name: 'Updated Bucket',
        icon: 'updated-icon.png',
        color: '#FF0000',
      };

      const error = new NotFoundException('Bucket not found');
      mockBucketsService.update.mockRejectedValue(error);

      await expect(
        controller.update('nonexistent', 'user-1', updateBucketDto),
      ).rejects.toThrow(NotFoundException);
      expect(bucketsService.update).toHaveBeenCalledWith(
        'nonexistent',
        'user-1',
        updateBucketDto,
      );
    });

    it('should handle forbidden access during update', async () => {
      const updateBucketDto: UpdateBucketDto = {
        name: 'Updated Bucket',
        icon: 'updated-icon.png',
        color: '#FF0000',
      };

      const error = new ForbiddenException(
        'You do not have admin access to this bucket',
      );
      mockBucketsService.update.mockRejectedValue(error);

      await expect(
        controller.update('bucket-1', 'user-2', updateBucketDto),
      ).rejects.toThrow(ForbiddenException);
      expect(bucketsService.update).toHaveBeenCalledWith(
        'bucket-1',
        'user-2',
        updateBucketDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove a bucket successfully', async () => {
      mockBucketsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('bucket-1', 'user-1');

      expect(result).toBeUndefined();
      expect(bucketsService.remove).toHaveBeenCalledWith('bucket-1', 'user-1');
    });

    it('should handle bucket not found during removal', async () => {
      const error = new NotFoundException('Bucket not found');
      mockBucketsService.remove.mockRejectedValue(error);

      await expect(controller.remove('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(bucketsService.remove).toHaveBeenCalledWith(
        'nonexistent',
        'user-1',
      );
    });

    it('should handle forbidden access during removal', async () => {
      const error = new ForbiddenException(
        'You do not have delete access to this bucket',
      );
      mockBucketsService.remove.mockRejectedValue(error);

      await expect(controller.remove('bucket-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(bucketsService.remove).toHaveBeenCalledWith('bucket-1', 'user-2');
    });
  });

  describe('getNotificationsCount', () => {
    it('should return notification count for bucket', async () => {
      const count = 5;
      mockBucketsService.getNotificationsCount.mockResolvedValue(count);

      const result = await controller.getNotificationsCount(
        'bucket-1',
        'user-1',
      );

      expect(result).toBe(count);
      expect(bucketsService.getNotificationsCount).toHaveBeenCalledWith(
        'bucket-1',
        'user-1',
      );
    });

    it('should return zero when no notifications exist', async () => {
      mockBucketsService.getNotificationsCount.mockResolvedValue(0);

      const result = await controller.getNotificationsCount(
        'bucket-1',
        'user-1',
      );

      expect(result).toBe(0);
      expect(bucketsService.getNotificationsCount).toHaveBeenCalledWith(
        'bucket-1',
        'user-1',
      );
    });

    it('should handle bucket not found for notifications count', async () => {
      const error = new NotFoundException('Bucket not found');
      mockBucketsService.getNotificationsCount.mockRejectedValue(error);

      await expect(
        controller.getNotificationsCount('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(bucketsService.getNotificationsCount).toHaveBeenCalledWith(
        'nonexistent',
        'user-1',
      );
    });

    it('should handle forbidden access for notifications count', async () => {
      const error = new ForbiddenException(
        'You do not have access to this bucket',
      );
      mockBucketsService.getNotificationsCount.mockRejectedValue(error);

      await expect(
        controller.getNotificationsCount('bucket-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
      expect(bucketsService.getNotificationsCount).toHaveBeenCalledWith(
        'bucket-1',
        'user-2',
      );
    });
  });

  describe('setBucketSnoozeMinutes', () => {
    it('should set bucket snooze for specified minutes', async () => {
      const mockUserBucket = {
        id: 'ub-1',
        bucketId: 'bucket-1',
        userId: 'user-1',
      } as any;

      mockBucketsService.setBucketSnoozeMinutes.mockResolvedValue(
        mockUserBucket,
      );

      const result = await controller.setBucketSnoozeMinutes(
        'bucket-1',
        { minutes: 30 },
        'user-1',
      );

      expect(result).toBe(mockUserBucket);
      expect(bucketsService.setBucketSnoozeMinutes).toHaveBeenCalledWith(
        'bucket-1',
        'user-1',
        30,
      );
    });
  });
});
