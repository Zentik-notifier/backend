import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  Event, 
  EventType,
} from '../entities';
import {
  EventsPerBucketUserDailyView,
  EventsPerBucketUserWeeklyView,
  EventsPerBucketUserMonthlyView,
  EventsPerBucketUserAllTimeView,
} from '../entities/views/events-analytics.views';
import { CreateEventDto, EventsQueryDto, EventsResponseDto, EventsPaginatedQueryDto } from './dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    @InjectRepository(EventsPerBucketUserDailyView)
    private bucketUserDailyViewRepository: Repository<EventsPerBucketUserDailyView>,
    @InjectRepository(EventsPerBucketUserWeeklyView)
    private bucketUserWeeklyViewRepository: Repository<EventsPerBucketUserWeeklyView>,
    @InjectRepository(EventsPerBucketUserMonthlyView)
    private bucketUserMonthlyViewRepository: Repository<EventsPerBucketUserMonthlyView>,
    @InjectRepository(EventsPerBucketUserAllTimeView)
    private bucketUserAllTimeViewRepository: Repository<EventsPerBucketUserAllTimeView>,
  ) {}

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

  // Metodi per le viste materializzate degli eventi per bucket per utente
  async getEventsPerBucketUserDaily(bucketId: string, userId: string, startDate?: Date, endDate?: Date): Promise<EventsPerBucketUserDailyView[]> {
    const queryBuilder = this.bucketUserDailyViewRepository
      .createQueryBuilder('view')
      .where('view.bucketId = :bucketId', { bucketId })
      .andWhere('view.userId = :userId', { userId });

    if (startDate) {
      queryBuilder.andWhere('view.periodStart >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('view.periodStart <= :endDate', { endDate });
    }

    return queryBuilder
      .orderBy('view.periodStart', 'DESC')
      .getMany();
  }

  async getEventsPerBucketUserWeekly(bucketId: string, userId: string, startDate?: Date, endDate?: Date): Promise<EventsPerBucketUserWeeklyView[]> {
    const queryBuilder = this.bucketUserWeeklyViewRepository
      .createQueryBuilder('view')
      .where('view.bucketId = :bucketId', { bucketId })
      .andWhere('view.userId = :userId', { userId });

    if (startDate) {
      queryBuilder.andWhere('view.periodStart >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('view.periodStart <= :endDate', { endDate });
    }

    return queryBuilder
      .orderBy('view.periodStart', 'DESC')
      .getMany();
  }

  async getEventsPerBucketUserMonthly(bucketId: string, userId: string, startDate?: Date, endDate?: Date): Promise<EventsPerBucketUserMonthlyView[]> {
    const queryBuilder = this.bucketUserMonthlyViewRepository
      .createQueryBuilder('view')
      .where('view.bucketId = :bucketId', { bucketId })
      .andWhere('view.userId = :userId', { userId });

    if (startDate) {
      queryBuilder.andWhere('view.periodStart >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('view.periodStart <= :endDate', { endDate });
    }

    return queryBuilder
      .orderBy('view.periodStart', 'DESC')
      .getMany();
  }

  async getEventsPerBucketUserAllTime(bucketId: string, userId: string): Promise<EventsPerBucketUserAllTimeView[]> {
    return this.bucketUserAllTimeViewRepository
      .createQueryBuilder('view')
      .where('view.bucketId = :bucketId', { bucketId })
      .andWhere('view.userId = :userId', { userId })
      .getMany();
  }

  // Metodo per ottenere tutte le statistiche per bucket per utente
  async getBucketUserEventStats(bucketId: string, userId: string, startDate?: Date, endDate?: Date): Promise<{
    daily: EventsPerBucketUserDailyView[];
    weekly: EventsPerBucketUserWeeklyView[];
    monthly: EventsPerBucketUserMonthlyView[];
    allTime: EventsPerBucketUserAllTimeView[];
  }> {
    const [daily, weekly, monthly, allTime] = await Promise.all([
      this.getEventsPerBucketUserDaily(bucketId, userId, startDate, endDate),
      this.getEventsPerBucketUserWeekly(bucketId, userId, startDate, endDate),
      this.getEventsPerBucketUserMonthly(bucketId, userId, startDate, endDate),
      this.getEventsPerBucketUserAllTime(bucketId, userId),
    ]);

    return {
      daily,
      weekly,
      monthly,
      allTime,
    };
  }
}
