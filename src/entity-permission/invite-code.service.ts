import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InviteCode } from '../entities/invite-code.entity';
import { EntityPermission } from '../entities/entity-permission.entity';
import { User } from '../entities/user.entity';
import { Permission, ResourceType } from '../auth/dto/auth.dto';
import { EntityPermissionService } from './entity-permission.service';
import { EventTrackingService } from '../events/event-tracking.service';
import {
  CreateInviteCodeInput,
  InviteCodeRedemptionResult,
} from './dto/invite-code.dto';
import * as crypto from 'crypto';

@Injectable()
export class InviteCodeService {
  private readonly logger = new Logger(InviteCodeService.name);

  constructor(
    @InjectRepository(InviteCode)
    private readonly inviteCodeRepository: Repository<InviteCode>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly entityPermissionService: EntityPermissionService,
    private readonly eventTrackingService: EventTrackingService,
  ) {}

  /**
   * Generate a secure random invite code (12 characters)
   */
  private generateCode(): string {
    const randomBytes = crypto.randomBytes(6);
    return randomBytes.toString('hex').toUpperCase();
  }

  /**
   * Create a new invite code
   */
  async createInviteCode(
    input: CreateInviteCodeInput,
    creatorUserId: string,
  ): Promise<InviteCode> {
    // Verify creator has ADMIN permission on the resource
    const hasAdminPermission = await this.entityPermissionService.hasPermissions(
      creatorUserId,
      input.resourceType,
      input.resourceId,
      [Permission.ADMIN],
    );

    if (!hasAdminPermission) {
      throw new BadRequestException(
        'You must have ADMIN permission to create invite codes',
      );
    }

    // Generate unique code
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = this.generateCode();
      const existing = await this.inviteCodeRepository.findOne({
        where: { code },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new BadRequestException('Failed to generate unique code');
    }

    // Parse expiresAt if provided
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    // Validate expiresAt is in the future
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    const inviteCode = this.inviteCodeRepository.create({
      code,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      createdBy: creatorUserId,
      permissions: input.permissions,
      expiresAt,
      maxUses: input.maxUses || null,
      usageCount: 0,
    });

    const saved = await this.inviteCodeRepository.save(inviteCode);
    this.logger.log(
      `Created invite code ${code} for ${input.resourceType}:${input.resourceId}`,
    );

    // Reload with relations to include creator
    const inviteCodeWithRelations = await this.inviteCodeRepository.findOne({
      where: { id: saved.id },
      relations: ['creator'],
    });

    return inviteCodeWithRelations!;
  }

  /**
   * Get all invite codes for a resource
   */
  async getInviteCodesForResource(
    resourceType: ResourceType,
    resourceId: string,
    userId: string,
  ): Promise<InviteCode[]> {
    // Verify user has ADMIN permission
    const hasAdminPermission = await this.entityPermissionService.hasPermissions(
      userId,
      resourceType,
      resourceId,
      [Permission.ADMIN],
    );

    if (!hasAdminPermission) {
      throw new BadRequestException(
        'You must have ADMIN permission to view invite codes',
      );
    }

    return this.inviteCodeRepository.find({
      where: { resourceType, resourceId },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Validate and redeem an invite code
   */
  async redeemInviteCode(
    code: string,
    userId: string,
  ): Promise<InviteCodeRedemptionResult> {
    // Find invite code
    const inviteCode = await this.inviteCodeRepository.findOne({
      where: { code },
      relations: ['creator'],
    });

    if (!inviteCode) {
      return {
        success: false,
        error: 'Invalid invite code',
      };
    }

    // Check if code has expired
    if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
      return {
        success: false,
        error: 'Invite code has expired',
      };
    }

    // Check if code has reached max uses
    if (
      inviteCode.maxUses !== null &&
      inviteCode.usageCount >= inviteCode.maxUses
    ) {
      return {
        success: false,
        error: 'Invite code has reached maximum uses',
      };
    }

    // Check if user already has permissions for this resource
    const existingPermissions = await this.entityPermissionService.hasPermissions(
      userId,
      inviteCode.resourceType,
      inviteCode.resourceId,
      [Permission.READ], // Check for any permission
    );

    if (existingPermissions) {
      return {
        success: false,
        error: 'You already have access to this resource',
      };
    }

    // Grant permissions to user
    try {
      await this.entityPermissionService.grantPermissions(
        inviteCode.resourceType,
        inviteCode.resourceId,
        { userId },
        inviteCode.permissions,
        inviteCode.createdBy, // Track who created the code
        inviteCode.expiresAt || undefined,
      );

      // Update the entity permission with inviteCodeId
      const permission = await this.entityPermissionService.findPermission(
        userId,
        inviteCode.resourceType,
        inviteCode.resourceId,
      );

      if (permission) {
        permission.inviteCodeId = inviteCode.id;
        await this.entityPermissionService.savePermission(permission);
      }

      // Increment usage count
      inviteCode.usageCount++;
      await this.inviteCodeRepository.save(inviteCode);

      this.logger.log(
        `User ${userId} redeemed invite code ${code} for ${inviteCode.resourceType}:${inviteCode.resourceId}`,
      );

      return {
        success: true,
        resourceType: inviteCode.resourceType,
        resourceId: inviteCode.resourceId,
        permissions: inviteCode.permissions,
      };
    } catch (error) {
      this.logger.error('Error redeeming invite code:', error);
      return {
        success: false,
        error: 'Failed to grant permissions',
      };
    }
  }

  /**
   * Update an invite code
   */
  async updateInviteCode(
    codeId: string,
    input: Partial<CreateInviteCodeInput>,
    userId: string,
  ): Promise<InviteCode> {
    const inviteCode = await this.inviteCodeRepository.findOne({
      where: { id: codeId },
      relations: ['creator'],
    });

    if (!inviteCode) {
      throw new NotFoundException('Invite code not found');
    }

    // Verify user has ADMIN permission
    const hasAdminPermission = await this.entityPermissionService.hasPermissions(
      userId,
      inviteCode.resourceType,
      inviteCode.resourceId,
      [Permission.ADMIN],
    );

    if (!hasAdminPermission) {
      throw new BadRequestException(
        'You must have ADMIN permission to update invite codes',
      );
    }

    // Update permissions if provided
    if (input.permissions) {
      inviteCode.permissions = input.permissions;
    }

    // Update expiresAt if provided
    if (input.expiresAt !== undefined) {
      if (input.expiresAt) {
        const expiresAt = new Date(input.expiresAt);
        if (expiresAt <= new Date()) {
          throw new BadRequestException('Expiration date must be in the future');
        }
        inviteCode.expiresAt = expiresAt;
      } else {
        inviteCode.expiresAt = null;
      }
    }

    // Update maxUses if provided
    if (input.maxUses !== undefined) {
      inviteCode.maxUses = input.maxUses || null;
    }

    const saved = await this.inviteCodeRepository.save(inviteCode);
    this.logger.log(`Updated invite code ${inviteCode.code}`);

    return saved;
  }

  /**
   * Delete an invite code
   */
  async deleteInviteCode(
    codeId: string,
    userId: string,
  ): Promise<void> {
    const inviteCode = await this.inviteCodeRepository.findOne({
      where: { id: codeId },
    });

    if (!inviteCode) {
      throw new NotFoundException('Invite code not found');
    }

    // Verify user has ADMIN permission
    const hasAdminPermission = await this.entityPermissionService.hasPermissions(
      userId,
      inviteCode.resourceType,
      inviteCode.resourceId,
      [Permission.ADMIN],
    );

    if (!hasAdminPermission) {
      throw new BadRequestException(
        'You must have ADMIN permission to delete invite codes',
      );
    }

    await this.inviteCodeRepository.remove(inviteCode);
    this.logger.log(`Deleted invite code ${inviteCode.code}`);
  }

  /**
   * Get invite code by ID
   */
  async getInviteCodeById(
    codeId: string,
    userId: string,
  ): Promise<InviteCode> {
    const inviteCode = await this.inviteCodeRepository.findOne({
      where: { id: codeId },
      relations: ['creator'],
    });

    if (!inviteCode) {
      throw new NotFoundException('Invite code not found');
    }

    // Verify user has ADMIN permission
    const hasAdminPermission = await this.entityPermissionService.hasPermissions(
      userId,
      inviteCode.resourceType,
      inviteCode.resourceId,
      [Permission.ADMIN],
    );

    if (!hasAdminPermission) {
      throw new BadRequestException(
        'You must have ADMIN permission to view invite codes',
      );
    }

    return inviteCode;
  }
}

