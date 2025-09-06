import { Test, TestingModule } from '@nestjs/testing';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';
import { JwtOrAccessTokenGuard } from '../../auth/guards/jwt-or-access-token.guard';
import { BucketsService } from '../../buckets/buckets.service';
import { CreateBucketDto, UpdateBucketDto } from '../../buckets/dto';
import { Bucket } from '../../entities/bucket.entity';
import { EntityPermission } from '../../entities/entity-permission.entity';
import {
  GrantEntityPermissionInput,
  RevokeEntityPermissionInput,
} from '../../entity-permission/dto/entity-permission.dto';
import { EntityPermissionService } from '../../entity-permission/entity-permission.service';
import { EventTrackingService } from '../../events/event-tracking.service';
import { UserBucketsService } from '../../user-buckets/user-buckets.service';
import { GraphQLSubscriptionService } from '../services/graphql-subscription.service';
import { BucketsResolver } from './buckets.resolver';

describe('BucketsResolver', () => {
  let resolver: BucketsResolver;
  let bucketsService: BucketsService;
  let subscriptionService: GraphQLSubscriptionService;
  let entityPermissionService: EntityPermissionService;
  let userBucketsService: UserBucketsService;

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

  const mockCreateBucketDto: CreateBucketDto = {
    name: 'Test Bucket',
    description: 'Test Description',
    icon: 'bucket-icon.png',
    color: '#FF0000',
  };

  const mockUpdateBucketDto: UpdateBucketDto = {
    name: 'Updated Bucket',
    description: 'Updated Description',
    icon: 'updated-icon.png',
    color: '#FF0000',
  };

  const mockEntityPermission: Partial<EntityPermission> = {
    id: 'permission-1',
    user: { id: 'user-2' } as any,
    resourceType: ResourceType.BUCKET,
    resourceId: 'bucket-1',
    permissions: [Permission.READ],
  };

  const mockBucketsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getBucketMessages: jest.fn(),
  };

  const mockSubscriptionService = {
    publishBucketCreated: jest.fn(),
    publishBucketUpdated: jest.fn(),
    publishBucketUpdatedToAllUsers: jest.fn(),
    publishBucketDeleted: jest.fn(),
    publishEntityPermissionUpdated: jest.fn(),
  };

  const mockEntityPermissionService = {
    getResourcePermissions: jest.fn(),
    grantPermissions: jest.fn(),
    revokePermissions: jest.fn(),
  };

  const mockUserBucketsService = {
    isSnoozed: jest.fn(),
  };

  const mockEventTrackingService = {
    trackBucketSharing: jest.fn(),
    trackBucketUnsharing: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BucketsResolver,
        {
          provide: BucketsService,
          useValue: mockBucketsService,
        },
        {
          provide: GraphQLSubscriptionService,
          useValue: mockSubscriptionService,
        },
        {
          provide: EntityPermissionService,
          useValue: mockEntityPermissionService,
        },
        {
          provide: UserBucketsService,
          useValue: mockUserBucketsService,
        },
        {
          provide: EventTrackingService,
          useValue: mockEventTrackingService,
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    resolver = module.get<BucketsResolver>(BucketsResolver);
    bucketsService = module.get<BucketsService>(BucketsService);
    subscriptionService = module.get<GraphQLSubscriptionService>(
      GraphQLSubscriptionService,
    );
    entityPermissionService = module.get<EntityPermissionService>(
      EntityPermissionService,
    );
    userBucketsService = module.get<UserBucketsService>(UserBucketsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('buckets', () => {
    it('should return all buckets for user', async () => {
      const buckets = [mockBucket];
      mockBucketsService.findAll.mockResolvedValue(buckets as Bucket[]);

      const result = await resolver.buckets('user-1');

      expect(result).toEqual(buckets);
      expect(bucketsService.findAll).toHaveBeenCalledWith('user-1');
    });
  });

  describe('bucket', () => {
    it('should return a bucket by ID', async () => {
      mockBucketsService.findOne.mockResolvedValue(mockBucket as Bucket);

      const result = await resolver.bucket('bucket-1', 'user-1');

      expect(result).toEqual(mockBucket);
      expect(bucketsService.findOne).toHaveBeenCalledWith('bucket-1', 'user-1');
    });
  });

  describe('createBucket', () => {
    it('should create a bucket successfully and publish subscription', async () => {
      mockBucketsService.create.mockResolvedValue(mockBucket as Bucket);
      mockSubscriptionService.publishBucketCreated.mockResolvedValue(undefined);

      const result = await resolver.createBucket(mockCreateBucketDto, 'user-1');

      expect(result).toEqual(mockBucket);
      expect(bucketsService.create).toHaveBeenCalledWith(
        'user-1',
        mockCreateBucketDto,
      );
      expect(subscriptionService.publishBucketCreated).toHaveBeenCalledWith(
        mockBucket,
        'user-1',
      );
    });
  });

  describe('updateBucket', () => {
    it('should update a bucket successfully and publish subscription', async () => {
      const updatedBucket = {
        ...mockBucket,
        ...mockUpdateBucketDto,
        user: { id: 'user-1' },
      };
      mockBucketsService.update.mockResolvedValue(updatedBucket as Bucket);
      mockEntityPermissionService.getResourcePermissions.mockResolvedValue([
        { user: { id: 'user-1' } },
      ] as EntityPermission[]);
      mockSubscriptionService.publishBucketUpdatedToAllUsers.mockResolvedValue(
        undefined,
      );

      const result = await resolver.updateBucket(
        'bucket-1',
        mockUpdateBucketDto,
        'user-1',
      );

      expect(result).toEqual(updatedBucket);
      expect(bucketsService.update).toHaveBeenCalledWith(
        'bucket-1',
        'user-1',
        mockUpdateBucketDto,
      );
      expect(
        subscriptionService.publishBucketUpdatedToAllUsers,
      ).toHaveBeenCalledWith(updatedBucket, 'user-1', ['user-1']);
    });
  });

  describe('deleteBucket', () => {
    it('should delete a bucket successfully and publish subscription', async () => {
      mockBucketsService.remove.mockResolvedValue(true);
      mockSubscriptionService.publishBucketDeleted.mockResolvedValue(undefined);

      const result = await resolver.deleteBucket('bucket-1', 'user-1');

      expect(result).toBe(true);
      expect(bucketsService.remove).toHaveBeenCalledWith('bucket-1', 'user-1');
      expect(subscriptionService.publishBucketDeleted).toHaveBeenCalledWith(
        'bucket-1',
        'user-1',
      );
    });
  });

  describe('bucketPermissions', () => {
    it('should return bucket permissions', async () => {
      const permissions = [mockEntityPermission];
      mockEntityPermissionService.getResourcePermissions.mockResolvedValue(
        permissions as EntityPermission[],
      );

      const result = await resolver.bucketPermissions('bucket-1', 'user-1');

      expect(result).toEqual(permissions);
      expect(
        entityPermissionService.getResourcePermissions,
      ).toHaveBeenCalledWith(ResourceType.BUCKET, 'bucket-1', 'user-1');
    });
  });

  describe('shareBucket', () => {
    it('should share bucket with another user successfully', async () => {
      const shareInput: GrantEntityPermissionInput = {
        userId: 'user-2',
        resourceType: ResourceType.BUCKET,
        resourceId: 'bucket-1',
        permissions: [Permission.READ],
      };

      const mockBucketWithUser = {
        ...mockBucket,
        user: { id: 'user-1' },
      };

      mockEntityPermissionService.grantPermissions.mockResolvedValue(
        mockEntityPermission as EntityPermission,
      );
      mockBucketsService.findOne.mockResolvedValue(
        mockBucketWithUser as Bucket,
      );
      mockEntityPermissionService.getResourcePermissions.mockResolvedValue([
        { user: { id: 'user-1' } },
        { user: { id: 'user-2' } },
      ] as EntityPermission[]);
      mockSubscriptionService.publishBucketUpdatedToAllUsers.mockResolvedValue(
        undefined,
      );
      mockSubscriptionService.publishEntityPermissionUpdated.mockResolvedValue(
        undefined,
      );

      const result = await resolver.shareBucket(shareInput, 'user-1');

      expect(result).toEqual(mockEntityPermission);
      expect(entityPermissionService.grantPermissions).toHaveBeenCalledWith(
        ResourceType.BUCKET,
        'bucket-1',
        { userId: 'user-2' },
        [Permission.READ],
        'user-1',
        undefined,
      );
      expect(
        subscriptionService.publishBucketUpdatedToAllUsers,
      ).toHaveBeenCalledWith(mockBucketWithUser, 'user-1', [
        'user-1',
        'user-2',
      ]);
    });
  });

  describe('unshareBucket', () => {
    it('should unshare bucket successfully', async () => {
      const revokeInput: RevokeEntityPermissionInput = {
        userId: 'user-2',
        resourceType: ResourceType.BUCKET,
        resourceId: 'bucket-1',
      };

      const mockBucketWithUser = {
        ...mockBucket,
        user: { id: 'user-1' },
      };

      mockEntityPermissionService.revokePermissions.mockResolvedValue(true);
      mockBucketsService.findOne.mockResolvedValue(
        mockBucketWithUser as Bucket,
      );
      mockEntityPermissionService.getResourcePermissions.mockResolvedValue([
        { user: { id: 'user-1' } },
      ] as EntityPermission[]);
      mockSubscriptionService.publishBucketUpdatedToAllUsers.mockResolvedValue(
        undefined,
      );

      const result = await resolver.unshareBucket(revokeInput, 'user-1');

      expect(result).toBe(true);
      expect(entityPermissionService.revokePermissions).toHaveBeenCalledWith(
        ResourceType.BUCKET,
        'bucket-1',
        { userId: 'user-2' },
        'user-1',
      );
      expect(
        subscriptionService.publishBucketUpdatedToAllUsers,
      ).toHaveBeenCalledWith(mockBucketWithUser, 'user-1', ['user-1']);
    });
  });

  describe('isSnoozedField', () => {
    it('should return snooze status for bucket', async () => {
      mockUserBucketsService.isSnoozed.mockResolvedValue(true);

      const result = await resolver.isSnoozedField(
        mockBucket as Bucket,
        'user-1',
      );

      expect(result).toBe(true);
      expect(userBucketsService.isSnoozed).toHaveBeenCalledWith(
        'bucket-1',
        'user-1',
      );
    });

    it('should return false when bucket is not snoozed', async () => {
      mockUserBucketsService.isSnoozed.mockResolvedValue(false);

      const result = await resolver.isSnoozedField(
        mockBucket as Bucket,
        'user-1',
      );

      expect(result).toBe(false);
      expect(userBucketsService.isSnoozed).toHaveBeenCalledWith(
        'bucket-1',
        'user-1',
      );
    });
  });
});
