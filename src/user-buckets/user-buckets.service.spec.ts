import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserBucketsService } from './user-buckets.service';
import { UserBucket } from '../entities/user-bucket.entity';
import { EventTrackingService } from '../events/event-tracking.service';
import {
  CreateUserBucketDto,
  UpdateUserBucketDto,
  SnoozeScheduleInput,
} from './dto';

describe('UserBucketsService', () => {
  let service: UserBucketsService;
  let userBucketRepository: Repository<UserBucket>;

  const mockBucket = {
    id: 'bucket-1',
    name: 'Test Bucket',
    icon: 'bucket-icon.png',
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
  };

  const mockUserBucket: Partial<UserBucket> = {
    id: 'ub-1',
    userId: 'user-1',
    bucketId: 'bucket-1',
    snoozeUntil: null,
    snoozes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    bucket: mockBucket as any,
    user: mockUser as any,
  };

  const mockCreateUserBucketDto: CreateUserBucketDto = {
    bucketId: 'bucket-1',
    snoozeUntil: undefined,
    snoozes: [],
  };

  const mockUpdateUserBucketDto: UpdateUserBucketDto = {
    snoozeUntil: '2024-12-31T23:59:59.000Z',
  };

  const mockSnoozeSchedule: SnoozeScheduleInput = {
    days: ['monday', 'tuesday'],
    timeFrom: '09:00',
    timeTill: '17:00',
    isEnabled: true,
  };

  const mockEventTrackingService = {
    trackBucketSharing: jest.fn(),
    trackBucketUnsharing: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserBucketsService,
        {
          provide: getRepositoryToken(UserBucket),
          useValue: {
            create: jest.fn().mockReturnValue(mockUserBucket),
            save: jest.fn().mockResolvedValue(mockUserBucket),
            find: jest.fn().mockResolvedValue([mockUserBucket]),
            findOne: jest.fn().mockResolvedValue(mockUserBucket),
            remove: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: EventTrackingService,
          useValue: mockEventTrackingService,
        },
      ],
    }).compile();

    service = module.get<UserBucketsService>(UserBucketsService);
    userBucketRepository = module.get<Repository<UserBucket>>(
      getRepositoryToken(UserBucket),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user bucket relationship successfully', async () => {
      jest.spyOn(userBucketRepository, 'findOne').mockResolvedValue(null);

      const result = await service.create('user-1', mockCreateUserBucketDto);

      expect(userBucketRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', bucketId: 'bucket-1' },
      });
      expect(userBucketRepository.create).toHaveBeenCalledWith({
        ...mockCreateUserBucketDto,
        userId: 'user-1',
        snoozeUntil: undefined,
        snoozes: [],
      });
      expect(userBucketRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUserBucket);
    });

    it('should throw ConflictException when user bucket relationship already exists', async () => {
      jest
        .spyOn(userBucketRepository, 'findOne')
        .mockResolvedValue(mockUserBucket as any);

      await expect(
        service.create('user-1', mockCreateUserBucketDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle snoozeUntil date conversion', async () => {
      jest.spyOn(userBucketRepository, 'findOne').mockResolvedValue(null);
      const dtoWithSnooze = {
        ...mockCreateUserBucketDto,
        snoozeUntil: '2024-12-31T23:59:59.000Z',
      };

      await service.create('user-1', dtoWithSnooze);

      expect(userBucketRepository.create).toHaveBeenCalledWith({
        ...dtoWithSnooze,
        userId: 'user-1',
        snoozeUntil: new Date('2024-12-31T23:59:59.000Z'),
        snoozes: [],
      });
    });
  });

  describe('findAllByUser', () => {
    it('should return all user buckets for a user', async () => {
      const result = await service.findAllByUser('user-1');

      expect(userBucketRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        relations: ['bucket'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockUserBucket]);
    });
  });

  describe('findOne', () => {
    it('should return a user bucket by id and userId', async () => {
      const result = await service.findOne('ub-1', 'user-1');

      expect(userBucketRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'ub-1', userId: 'user-1' },
        relations: ['bucket'],
      });
      expect(result).toEqual(mockUserBucket);
    });

    it('should throw NotFoundException when user bucket not found', async () => {
      jest.spyOn(userBucketRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByBucketAndUser', () => {
    it('should return user bucket for specific bucket and user', async () => {
      const result = await service.findByBucketAndUser('bucket-1', 'user-1');

      expect(userBucketRepository.findOne).toHaveBeenCalledWith({
        where: { bucketId: 'bucket-1', userId: 'user-1' },
        relations: ['bucket'],
      });
      expect(result).toEqual(mockUserBucket);
    });

    it('should return null when no relationship exists', async () => {
      jest.spyOn(userBucketRepository, 'findOne').mockResolvedValue(null);

      const result = await service.findByBucketAndUser('bucket-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('findByBucketAndUsers', () => {
    it('should return user buckets for multiple users in a bucket', async () => {
      const result = await service.findByBucketAndUsers('bucket-1', [
        'user-1',
        'user-2',
      ]);

      expect(userBucketRepository.find).toHaveBeenCalledWith({
        where: { bucketId: 'bucket-1', userId: expect.any(Object) },
        relations: ['bucket'],
      });
      expect(result).toEqual([mockUserBucket]);
    });

    it('should return empty array when no userIds provided', async () => {
      const result = await service.findByBucketAndUsers('bucket-1', []);

      expect(result).toEqual([]);
      expect(userBucketRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreateByBucketAndUser', () => {
    it('should return existing user bucket when relationship exists', async () => {
      jest
        .spyOn(service, 'findByBucketAndUser')
        .mockResolvedValue(mockUserBucket as any);

      const result = await service.findOrCreateByBucketAndUser(
        'bucket-1',
        'user-1',
      );

      expect(service.findByBucketAndUser).toHaveBeenCalledWith(
        'bucket-1',
        'user-1',
      );
      expect(result).toEqual(mockUserBucket);
    });

    it('should create new user bucket when relationship does not exist', async () => {
      jest.spyOn(service, 'findByBucketAndUser').mockResolvedValue(null);
      jest.spyOn(service, 'create').mockResolvedValue(mockUserBucket as any);

      const result = await service.findOrCreateByBucketAndUser(
        'bucket-1',
        'user-1',
      );

      expect(service.create).toHaveBeenCalledWith('user-1', {
        bucketId: 'bucket-1',
        snoozeUntil: undefined,
        snoozes: [],
      });
      expect(result).toEqual(mockUserBucket);
    });
  });

  describe('update', () => {
    it('should update user bucket successfully', async () => {
      const result = await service.update(
        'ub-1',
        'user-1',
        mockUpdateUserBucketDto,
      );

      expect(userBucketRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'ub-1', userId: 'user-1' },
        relations: ['bucket'],
      });
      expect(userBucketRepository.save).toHaveBeenCalledWith(mockUserBucket);
      expect(result).toEqual(mockUserBucket);
    });

    it('should handle snoozeUntil date conversion', async () => {
      const dtoWithDate = { snoozeUntil: '2024-12-31T23:59:59.000Z' };

      await service.update('ub-1', 'user-1', dtoWithDate);

      expect(userBucketRepository.save).toHaveBeenCalledWith({
        ...mockUserBucket,
        snoozeUntil: new Date('2024-12-31T23:59:59.000Z'),
      });
    });
  });

  describe('remove', () => {
    it('should remove user bucket successfully', async () => {
      await service.remove('ub-1', 'user-1');

      expect(userBucketRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'ub-1', userId: 'user-1' },
        relations: ['bucket'],
      });
      expect(userBucketRepository.remove).toHaveBeenCalledWith(mockUserBucket);
    });
  });

  describe('setBucketSnooze', () => {
    it('should set bucket snooze successfully', async () => {
      const result = await service.setBucketSnooze(
        'bucket-1',
        'user-1',
        '2024-12-31T23:59:59.000Z',
      );

      expect(userBucketRepository.findOne).toHaveBeenCalledWith({
        where: { bucketId: 'bucket-1', userId: 'user-1' },
        relations: ['bucket'],
      });
      expect(result).toEqual(mockUserBucket);
    });

    it('should clear bucket snooze when snoozeUntil is null', async () => {
      const result = await service.setBucketSnooze('bucket-1', 'user-1', null);

      expect(userBucketRepository.findOne).toHaveBeenCalledWith({
        where: { bucketId: 'bucket-1', userId: 'user-1' },
        relations: ['bucket'],
      });
      expect(result).toEqual(mockUserBucket);
    });
  });

  describe('updateBucketSnoozes', () => {
    it('should update bucket snoozes successfully', async () => {
      const result = await service.updateBucketSnoozes('bucket-1', 'user-1', [
        mockSnoozeSchedule,
      ]);

      expect(userBucketRepository.findOne).toHaveBeenCalledWith({
        where: { bucketId: 'bucket-1', userId: 'user-1' },
        relations: ['bucket'],
      });
      expect(userBucketRepository.save).toHaveBeenCalledWith({
        ...mockUserBucket,
        snoozes: [mockSnoozeSchedule],
      });
      expect(result).toEqual(mockUserBucket);
    });
  });
});
