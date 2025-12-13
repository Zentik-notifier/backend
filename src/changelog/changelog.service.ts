import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Changelog } from '../entities/changelog.entity';
import { CreateChangelogInput, UpdateChangelogInput } from './dto';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

@Injectable()
export class ChangelogService {
  private readonly logger = new Logger(ChangelogService.name);

  constructor(
    @InjectRepository(Changelog)
    private readonly changelogRepository: Repository<Changelog>,
    private readonly serverSettingsService: ServerSettingsService,
  ) {}

  async getLatest(): Promise<Changelog | null> {
    return this.changelogRepository.findOne({
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<Changelog[]> {
    const remoteBase = await this.serverSettingsService.getStringValue(
      ServerSettingType.ChangelogRemoteServer,
    );

    if (remoteBase) {
      try {
        const baseUrl = remoteBase.replace(/\/$/, '');
        const res = await fetch(`${baseUrl}/changelogs`);

        if (res.ok) {
          const data = await res.json();
          return data as Changelog[];
        }

        this.logger.warn(
          `Remote changelog list request failed with status ${res.status}, falling back to local repository`,
        );
      } catch (err) {
        this.logger.warn(
          `Remote changelog list request errored, falling back to local repository: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return this.changelogRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Changelog> {
    const remoteBase = await this.serverSettingsService.getStringValue(
      ServerSettingType.ChangelogRemoteServer,
    );

    if (remoteBase) {
      try {
        const baseUrl = remoteBase.replace(/\/$/, '');
        const res = await fetch(`${baseUrl}/changelogs/${id}`);

        if (res.status === 404) {
          throw new NotFoundException(`Changelog with id ${id} not found`);
        }

        if (res.ok) {
          const data = await res.json();
          return data as Changelog;
        }

        this.logger.warn(
          `Remote changelog detail request failed with status ${res.status}, falling back to local repository`,
        );
      } catch (err) {
        this.logger.warn(
          `Remote changelog detail request errored, falling back to local repository: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const item = await this.changelogRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Changelog with id ${id} not found`);
    }
    return item;
  }

  async create(input: CreateChangelogInput): Promise<Changelog> {
    const entity = this.changelogRepository.create({
      iosVersion: input.iosVersion ?? '',
      androidVersion: input.androidVersion ?? '',
      uiVersion: input.uiVersion ?? '',
      backendVersion: input.backendVersion ?? '',
      description: input.description,
    });
    return this.changelogRepository.save(entity);
  }

  async update(input: UpdateChangelogInput): Promise<Changelog> {
    const existing = await this.findOne(input.id);
    Object.assign(existing, {
      iosVersion: input.iosVersion ?? existing.iosVersion,
      androidVersion: input.androidVersion ?? existing.androidVersion,
      uiVersion: input.uiVersion ?? existing.uiVersion,
      backendVersion: input.backendVersion ?? existing.backendVersion,
      description: input.description ?? existing.description,
    });
    return this.changelogRepository.save(existing);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.changelogRepository.delete(id);
    return !!result.affected && result.affected > 0;
  }
}
