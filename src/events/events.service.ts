import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Event,
  EventType,
} from '../entities';
import { CreateEventDto, EventsQueryDto, EventsResponseDto, EventsPaginatedQueryDto } from './dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
  ) { }

  async createEvent(createEventDto: CreateEventDto): Promise<Event> {
    const event = this.eventsRepository.create(createEventDto);
    return this.eventsRepository.save(event);
  }

  async findAll(): Promise<Event[]> {
    return this.eventsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByType(type: EventType): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { type },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUserId(userId: string): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByObjectId(objectId: string): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { objectId },
      order: { createdAt: 'DESC' },
    });
  }

  async getEventCount(): Promise<number> {
    return this.eventsRepository.count();
  }

  async findAllPaginated(query: EventsQueryDto): Promise<EventsResponseDto> {
    const { page = 1, limit = 20, type, userId, objectId, targetId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.eventsRepository
      .createQueryBuilder('event')
      .orderBy('event.createdAt', 'DESC');

    if (type) {
      queryBuilder.andWhere('event.type = :type', { type });
    }

    if (userId) {
      queryBuilder.andWhere('event.userId = :userId', { userId });
    }

    if (objectId) {
      queryBuilder.andWhere('event.objectId = :objectId', { objectId });
    }

    if (targetId) {
      queryBuilder.andWhere('event.targetId = :targetId', { targetId });
    }

    const [events, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const response = new EventsResponseDto();
    response.events = events;
    response.total = total;
    response.page = page;
    response.limit = limit;

    return response;
  }

  async findByTypePaginated(type: EventType, query: EventsPaginatedQueryDto): Promise<EventsResponseDto> {
    return this.findAllPaginated({ ...query, type });
  }

  async findByUserIdPaginated(userId: string, query: EventsPaginatedQueryDto): Promise<EventsResponseDto> {
    return this.findAllPaginated({ ...query, userId });
  }

  async findByObjectIdPaginated(objectId: string, query: EventsPaginatedQueryDto): Promise<EventsResponseDto> {
    return this.findAllPaginated({ ...query, objectId });
  }
}
