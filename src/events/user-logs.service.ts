import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventType, UserLog, UserLogType } from '../entities';
import { EventsService } from './events.service';
import { CreateUserLogInput } from './dto/create-user-log.dto';

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
}


