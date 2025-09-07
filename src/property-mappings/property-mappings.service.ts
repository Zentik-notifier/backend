import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyMapping } from '../entities/property-mapping.entity';
import { CreatePropertyMappingDto, UpdatePropertyMappingDto } from './dto';

@Injectable()
export class PropertyMappingsService {
  constructor(
    @InjectRepository(PropertyMapping)
    private propertyMappingRepository: Repository<PropertyMapping>,
  ) {}

  async create(createPropertyMappingDto: CreatePropertyMappingDto, userId: string): Promise<PropertyMapping> {
    const propertyMapping = this.propertyMappingRepository.create({
      ...createPropertyMappingDto,
      userId,
    });

    return this.propertyMappingRepository.save(propertyMapping);
  }

  async findAll(userId: string): Promise<PropertyMapping[]> {
    return this.propertyMappingRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<PropertyMapping> {
    const propertyMapping = await this.propertyMappingRepository.findOne({
      where: { id, userId },
    });

    if (!propertyMapping) {
      throw new NotFoundException('Property mapping not found');
    }

    return propertyMapping;
  }

  async update(id: string, updatePropertyMappingDto: UpdatePropertyMappingDto, userId: string): Promise<PropertyMapping> {
    const propertyMapping = await this.findOne(id, userId);

    Object.assign(propertyMapping, updatePropertyMappingDto);

    return this.propertyMappingRepository.save(propertyMapping);
  }

  async remove(id: string, userId: string): Promise<void> {
    const propertyMapping = await this.findOne(id, userId);
    await this.propertyMappingRepository.remove(propertyMapping);
  }

  async findByUserId(userId: string): Promise<PropertyMapping[]> {
    return this.propertyMappingRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}