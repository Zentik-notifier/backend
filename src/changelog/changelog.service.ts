import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Changelog } from '../entities/changelog.entity';
import { CreateChangelogInput, UpdateChangelogInput } from './dto';

@Injectable()
export class ChangelogService {
  constructor(
    @InjectRepository(Changelog)
    private readonly changelogRepository: Repository<Changelog>,
  ) {}

  async getLatest(): Promise<Changelog | null> {
    return this.changelogRepository.findOne({
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<Changelog[]> {
    return this.changelogRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Changelog> {
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
