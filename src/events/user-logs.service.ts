import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventType, UserLog, UserLogType } from '../entities';
import { EventsService } from './events.service';
import { CreateUserLogInput } from './dto/create-user-log.dto';
import {
  GetUserLogsInput,
  PaginatedUserLogs,
} from './dto/get-user-logs.dto';

@Injectable()
export class UserLogsService {
  constructor(
    @InjectRepository(UserLog)
    private readonly userLogsRepository: Repository<UserLog>,
    private readonly eventsService: EventsService,
  ) { }

  async createUserLog(
    effectiveUserId: string | undefined,
    input: CreateUserLogInput,
  ): Promise<UserLog> {
    const log = this.userLogsRepository.create({
      type: input.type,
      payload: input.payload,
      userId: input.userId ?? effectiveUserId ?? null,
    });

    const saved = await this.userLogsRepository.save(log);

    if (input.type === UserLogType.FEEDBACK) {
      // Create an Event for admin notifications, without duplicating the full payload
      await this.eventsService.createEvent({
        type: EventType.USER_FEEDBACK,
        userId: saved.userId ?? undefined,
        objectId: saved.id,
        additionalInfo: {
          userLogId: saved.id,
        },
      });
    }

    return saved;
  }

  async getUserLogs(input: GetUserLogsInput): Promise<PaginatedUserLogs> {
    const { page = 1, limit = 50, type, userId, search } = input;
    const qb = this.userLogsRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (type) {
      qb.andWhere('log.type = :type', { type });
    }

    if (userId) {
      qb.andWhere('log.userId = :userId', { userId });
    }

    if (search) {
      qb.andWhere('log.payload::text ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [logs, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      logs,
      total,
      page,
      limit,
      totalPages,
    };
  }
}


