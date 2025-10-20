import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InviteCodeService } from './invite-code.service';
import { InviteCode } from '../entities/invite-code.entity';
import { EntityPermission } from '../entities/entity-permission.entity';
import { User } from '../entities/user.entity';
import { EntityPermissionService } from './entity-permission.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { Permission, ResourceType } from '../auth/dto/auth.dto';

describe('InviteCodeService', () => {
  let service: InviteCodeService;
  let inviteCodeRepository: Repository<InviteCode>;
  let entityPermissionService: EntityPermissionService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
  };

  const mockInviteCode: Partial<InviteCode> = {
    id: 'code-1',
    code: 'ABC123DEF456',
    resourceType: ResourceType.BUCKET,
    resourceId: 'bucket-1',
    createdBy: 'user-1',
    permissions: [Permission.READ, Permission.WRITE],
    expiresAt: null,
    maxUses: null,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteCodeService,
        {
          provide: getRepositoryToken(InviteCode),
          useValue: {
            create: jest.fn().mockReturnValue(mockInviteCode),
            save: jest.fn().mockResolvedValue(mockInviteCode),
            find: jest.fn().mockResolvedValue([mockInviteCode]),
            findOne: jest.fn().mockResolvedValue(mockInviteCode),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: EntityPermissionService,
          useValue: {
            hasPermissions: jest.fn().mockResolvedValue(true),
            grantPermissions: jest.fn().mockResolvedValue({} as EntityPermission),
            findPermission: jest.fn().mockResolvedValue({
              id: 'perm-1',
              inviteCodeId: null,
            } as EntityPermission),
            savePermission: jest.fn().mockResolvedValue({} as EntityPermission),
          },
        },
        {
          provide: EventTrackingService,
          useValue: {
            trackEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InviteCodeService>(InviteCodeService);
    inviteCodeRepository = module.get<Repository<InviteCode>>(
      getRepositoryToken(InviteCode),
    );
    entityPermissionService = module.get<EntityPermissionService>(
      EntityPermissionService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInviteCode', () => {
    it('should create an invite code successfully', async () => {
      const input = {
        resourceType: ResourceType.BUCKET,
        resourceId: 'bucket-1',
        permissions: [Permission.READ, Permission.WRITE],
      };

      jest.spyOn(inviteCodeRepository, 'findOne').mockResolvedValue(null);

      const result = await service.createInviteCode(input, 'user-1');

      expect(entityPermissionService.hasPermissions).toHaveBeenCalledWith(
        'user-1',
        ResourceType.BUCKET,
        'bucket-1',
        [Permission.ADMIN],
      );
      expect(inviteCodeRepository.create).toHaveBeenCalled();
      expect(inviteCodeRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if user does not have ADMIN permission', async () => {
      const input = {
        resourceType: ResourceType.BUCKET,
        resourceId: 'bucket-1',
        permissions: [Permission.READ],
      };

      jest
        .spyOn(entityPermissionService, 'hasPermissions')
        .mockResolvedValue(false);

      await expect(
        service.createInviteCode(input, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if expiration date is in the past', async () => {
      const input = {
        resourceType: ResourceType.BUCKET,
        resourceId: 'bucket-1',
        permissions: [Permission.READ],
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };

      await expect(
        service.createInviteCode(input, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('redeemInviteCode', () => {
    it('should redeem code successfully', async () => {
      jest
        .spyOn(entityPermissionService, 'hasPermissions')
        .mockResolvedValue(false); // User doesn't have access yet

      const result = await service.redeemInviteCode('ABC123DEF456', 'user-2');

      expect(result.success).toBe(true);
      expect(result.resourceType).toBe(ResourceType.BUCKET);
      expect(result.resourceId).toBe('bucket-1');
      expect(entityPermissionService.grantPermissions).toHaveBeenCalled();
      expect(inviteCodeRepository.save).toHaveBeenCalled();
    });

    it('should return error for invalid code', async () => {
      jest.spyOn(inviteCodeRepository, 'findOne').mockResolvedValue(null);

      const result = await service.redeemInviteCode('INVALID', 'user-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid invite code');
    });

    it('should return error for expired code', async () => {
      const expiredCode = {
        ...mockInviteCode,
        expiresAt: new Date(Date.now() - 1000),
      };

      jest
        .spyOn(inviteCodeRepository, 'findOne')
        .mockResolvedValue(expiredCode as InviteCode);

      const result = await service.redeemInviteCode('ABC123DEF456', 'user-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invite code has expired');
    });

    it('should return error when max uses reached', async () => {
      const maxedCode = {
        ...mockInviteCode,
        maxUses: 5,
        usageCount: 5,
      };

      jest
        .spyOn(inviteCodeRepository, 'findOne')
        .mockResolvedValue(maxedCode as InviteCode);

      const result = await service.redeemInviteCode('ABC123DEF456', 'user-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invite code has reached maximum uses');
    });

    it('should return error when user already has access', async () => {
      jest
        .spyOn(entityPermissionService, 'hasPermissions')
        .mockResolvedValue(true);

      const result = await service.redeemInviteCode('ABC123DEF456', 'user-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You already have access to this resource');
    });
  });

  describe('getInviteCodesForResource', () => {
    it('should return invite codes for resource', async () => {
      const result = await service.getInviteCodesForResource(
        ResourceType.BUCKET,
        'bucket-1',
        'user-1',
      );

      expect(entityPermissionService.hasPermissions).toHaveBeenCalledWith(
        'user-1',
        ResourceType.BUCKET,
        'bucket-1',
        [Permission.ADMIN],
      );
      expect(inviteCodeRepository.find).toHaveBeenCalledWith({
        where: { resourceType: ResourceType.BUCKET, resourceId: 'bucket-1' },
        relations: ['creator'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockInviteCode]);
    });

    it('should throw BadRequestException if user does not have ADMIN permission', async () => {
      jest
        .spyOn(entityPermissionService, 'hasPermissions')
        .mockResolvedValue(false);

      await expect(
        service.getInviteCodesForResource(
          ResourceType.BUCKET,
          'bucket-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteInviteCode', () => {
    it('should delete invite code successfully', async () => {
      await service.deleteInviteCode('code-1', 'user-1');

      expect(inviteCodeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'code-1' },
      });
      expect(entityPermissionService.hasPermissions).toHaveBeenCalledWith(
        'user-1',
        ResourceType.BUCKET,
        'bucket-1',
        [Permission.ADMIN],
      );
      expect(inviteCodeRepository.remove).toHaveBeenCalled();
    });

    it('should throw NotFoundException if code does not exist', async () => {
      jest.spyOn(inviteCodeRepository, 'findOne').mockResolvedValue(null);

      await expect(service.deleteInviteCode('code-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user does not have ADMIN permission', async () => {
      jest
        .spyOn(entityPermissionService, 'hasPermissions')
        .mockResolvedValue(false);

      await expect(service.deleteInviteCode('code-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

