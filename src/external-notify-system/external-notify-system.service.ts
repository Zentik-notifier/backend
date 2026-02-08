import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission, ResourceType } from '../auth/dto/auth.dto';
import { Repository } from 'typeorm';
import { ExternalNotifySystem, ExternalNotifySystemType } from '../entities/external-notify-system.entity';
import { EntityPermissionService } from '../entity-permission/entity-permission.service';
import { GotifySubscriptionService } from './providers/gotify/gotify-subscription.service';
import { NtfySubscriptionService } from './providers/ntfy/ntfy-subscription.service';
import { ResourcePermissionsDto } from '../entity-permission/dto/entity-permission.dto';
import { ExternalNotifyCredentialsStore } from './external-notify-credentials.store';
import {
  CreateExternalNotifySystemDto,
  UpdateExternalNotifySystemDto,
} from './dto';

@Injectable()
export class ExternalNotifySystemService {
  constructor(
    @InjectRepository(ExternalNotifySystem)
    private readonly repo: Repository<ExternalNotifySystem>,
    private readonly entityPermissionService: EntityPermissionService,
    private readonly credentialsStore: ExternalNotifyCredentialsStore,
    private readonly ntfySubscriptionService: NtfySubscriptionService,
    private readonly gotifySubscriptionService: GotifySubscriptionService,
  ) {}

  async findAll(userId: string): Promise<ExternalNotifySystem[]> {
    const owned = await this.repo.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const shared = await this.repo
      .createQueryBuilder('system')
      .leftJoinAndSelect('system.user', 'user')
      .innerJoin(
        'entity_permissions',
        'ep',
        'ep.resourceType = :resourceType AND ep.resourceId = system.id AND ep.userId = :userId',
        { resourceType: ResourceType.EXTERNAL_NOTIFY_SYSTEM, userId },
      )
      .where('system.userId != :userId', { userId })
      .orderBy('system.createdAt', 'DESC')
      .getMany();

    const combined = [...owned, ...shared];
    const seen = new Set<string>();
    const unique = combined.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    return unique.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async findOne(id: string, userId: string): Promise<ExternalNotifySystem> {
    const system = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!system) {
      throw new NotFoundException('External notify system not found');
    }
    const isOwner = system.userId === userId;
    if (!isOwner) {
      const canRead = await this.entityPermissionService.hasPermissions(
        userId,
        ResourceType.EXTERNAL_NOTIFY_SYSTEM,
        id,
        [Permission.READ],
      );
      if (!canRead) {
        throw new ForbiddenException(
          'Access denied to this external notify system',
        );
      }
    }
    return system;
  }

  async create(
    userId: string,
    dto: CreateExternalNotifySystemDto,
  ): Promise<ExternalNotifySystem> {
    const { authUser, authPassword, authToken, ...rest } = dto;
    const entity = this.repo.create({ ...rest, user: { id: userId } });
    const saved = await this.repo.save(entity);
    if (authUser !== undefined || authPassword !== undefined || authToken !== undefined) {
      await this.credentialsStore.set(userId, saved.id, {
        authUser: authUser ?? null,
        authPassword: authPassword ?? null,
        authToken: authToken ?? null,
      });
    }
    return this.repo.findOneOrFail({
      where: { id: saved.id },
      relations: ['user'],
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateExternalNotifySystemDto,
  ): Promise<ExternalNotifySystem> {
    const system = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!system) {
      throw new NotFoundException('External notify system not found');
    }
    const isOwner = system.userId === userId;
    if (!isOwner) {
      const canWrite = await this.entityPermissionService.hasPermissions(
        userId,
        ResourceType.EXTERNAL_NOTIFY_SYSTEM,
        id,
        [Permission.WRITE],
      );
      if (!canWrite) {
        throw new ForbiddenException(
          'You do not have write access to this external notify system',
        );
      }
    }
    const { authUser, authPassword, authToken, ...rest } = dto;
    Object.assign(system, rest);
    await this.repo.save(system);
    const hasAuthInput =
      authUser !== undefined || authPassword !== undefined || authToken !== undefined;
    if (hasAuthInput) {
      const existing = await this.credentialsStore.get(userId, id);
      await this.credentialsStore.set(userId, id, {
        authUser: authUser !== undefined ? authUser : (existing?.authUser ?? null),
        authPassword:
          authPassword !== undefined ? authPassword : (existing?.authPassword ?? null),
        authToken: authToken !== undefined ? authToken : (existing?.authToken ?? null),
      });
    }
    if (system.type === ExternalNotifySystemType.NTFY) {
      this.ntfySubscriptionService.refreshSubscriptionForSystem(id).catch(() => {});
    }
    if (system.type === ExternalNotifySystemType.Gotify) {
      this.gotifySubscriptionService.refreshSubscriptionForSystem(id).catch(() => {});
    }
    return this.repo.findOneOrFail({
      where: { id },
      relations: ['user'],
    });
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const system = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!system) {
      throw new NotFoundException('External notify system not found');
    }
    const isOwner = system.userId === userId;
    if (!isOwner) {
      const canDelete = await this.entityPermissionService.hasPermissions(
        userId,
        ResourceType.EXTERNAL_NOTIFY_SYSTEM,
        id,
        [Permission.DELETE],
      );
      if (!canDelete) {
        throw new ForbiddenException(
          'You do not have delete access to this external notify system',
        );
      }
    }
    await this.credentialsStore.delete(system.userId, id);
    await this.repo.remove(system);
    return true;
  }

  async calculatePermissions(
    system: ExternalNotifySystem,
    userId: string,
  ): Promise<ResourcePermissionsDto> {
    const isOwner = system.user?.id === userId;

    const allPermissions = await this.entityPermissionService.getResourcePermissions(
      ResourceType.EXTERNAL_NOTIFY_SYSTEM,
      system.id,
      userId,
    );
    const permissions = allPermissions.flatMap((p) => p.permissions);

    const canRead =
      isOwner ||
      permissions.includes(Permission.READ) ||
      permissions.includes(Permission.WRITE) ||
      permissions.includes(Permission.ADMIN);

    const canWrite =
      isOwner ||
      permissions.includes(Permission.WRITE) ||
      permissions.includes(Permission.ADMIN);

    const canDelete =
      isOwner ||
      permissions.includes(Permission.DELETE) ||
      permissions.includes(Permission.ADMIN);

    const canAdmin = isOwner || permissions.includes(Permission.ADMIN);

    const isSharedWithMe = !isOwner && permissions.length > 0;

    const sharedList = await this.entityPermissionService.getResourcePermissions(
      ResourceType.EXTERNAL_NOTIFY_SYSTEM,
      system.id,
      userId,
    );
    const sharedCount = sharedList.length;

    return {
      canRead,
      canWrite,
      canDelete,
      canAdmin,
      isOwner,
      isSharedWithMe,
      sharedCount,
    };
  }
}
