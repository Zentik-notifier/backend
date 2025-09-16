import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  Event, 
  EventType,
  NotificationsPerBucketUserDailyView,
  NotificationsPerBucketUserWeeklyView,
  NotificationsPerBucketUserMonthlyView,
  NotificationsPerBucketUserAllTimeView,
} from '../entities';
import { CreateEventDto } from './dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    @InjectRepository(NotificationsPerBucketUserDailyView)
    private bucketUserDailyViewRepository: Repository<NotificationsPerBucketUserDailyView>,
    @InjectRepository(NotificationsPerBucketUserWeeklyView)
    private bucketUserWeeklyViewRepository: Repository<NotificationsPerBucketUserWeeklyView>,
    @InjectRepository(NotificationsPerBucketUserMonthlyView)
    private bucketUserMonthlyViewRepository: Repository<NotificationsPerBucketUserMonthlyView>,
    @InjectRepository(NotificationsPerBucketUserAllTimeView)
    private bucketUserAllTimeViewRepository: Repository<NotificationsPerBucketUserAllTimeView>,
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

  // Metodi per le viste materializzate delle notifiche per bucket per utente
  async getNotificationsPerBucketUserDaily(bucketId: string, userId: string, startDate?: Date, endDate?: Date): Promise<NotificationsPerBucketUserDailyView[]> {
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

  async getNotificationsPerBucketUserWeekly(bucketId: string, userId: string, startDate?: Date, endDate?: Date): Promise<NotificationsPerBucketUserWeeklyView[]> {
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

  async getNotificationsPerBucketUserMonthly(bucketId: string, userId: string, startDate?: Date, endDate?: Date): Promise<NotificationsPerBucketUserMonthlyView[]> {
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

  async getNotificationsPerBucketUserAllTime(bucketId: string, userId: string): Promise<NotificationsPerBucketUserAllTimeView | null> {
    return this.bucketUserAllTimeViewRepository
      .createQueryBuilder('view')
      .where('view.bucketId = :bucketId', { bucketId })
      .andWhere('view.userId = :userId', { userId })
      .getOne();
  }

  // Metodo per ottenere tutte le statistiche per bucket per utente
  async getBucketUserNotificationStats(bucketId: string, userId: string, startDate?: Date, endDate?: Date): Promise<{
    daily: NotificationsPerBucketUserDailyView[];
    weekly: NotificationsPerBucketUserWeeklyView[];
    monthly: NotificationsPerBucketUserMonthlyView[];
    allTime: NotificationsPerBucketUserAllTimeView | null;
  }> {
    const [daily, weekly, monthly, allTime] = await Promise.all([
      this.getNotificationsPerBucketUserDaily(bucketId, userId, startDate, endDate),
      this.getNotificationsPerBucketUserWeekly(bucketId, userId, startDate, endDate),
      this.getNotificationsPerBucketUserMonthly(bucketId, userId, startDate, endDate),
      this.getNotificationsPerBucketUserAllTime(bucketId, userId),
    ]);

    return {
      daily,
      weekly,
      monthly,
      allTime,
    };
  }
}
