import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { Event, EventType } from '../entities';
import {
  EventsPaginatedQueryDto,
  EventsQueryDto,
  EventsResponseDto,
} from './dto';
import { EventsService } from './events.service';

@ApiTags('Events')
@Controller('events')
@UseGuards(AdminOnlyGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll(
    @Query() query?: EventsQueryDto,
  ): Promise<Event[] | EventsResponseDto> {
    // Se vengono passati parametri di paginazione, usa la versione paginata
    if (
      query &&
      (query.page !== undefined ||
        query.limit !== undefined ||
        query.type ||
        query.userId ||
        query.objectId)
    ) {
      return this.eventsService.findAllPaginated(query);
    }
    // Altrimenti, usa la versione originale per compatibilità
    return this.eventsService.findAll();
  }

  @Get('paginated')
  async findAllPaginated(
    @Query() query: EventsQueryDto,
  ): Promise<EventsResponseDto> {
    return this.eventsService.findAllPaginated(query);
  }

  @Get('count')
  async getEventCount(): Promise<{ count: number }> {
    const count = await this.eventsService.getEventCount();
    return { count };
  }

  @Get('by-type')
  async findByType(
    @Query('type') type: EventType,
    @Query() query?: EventsPaginatedQueryDto,
  ): Promise<Event[] | EventsResponseDto> {
    if (query && (query.page !== undefined || query.limit !== undefined)) {
      return this.eventsService.findByTypePaginated(type, query);
    }
    return this.eventsService.findByType(type);
  }

  @Get('by-user')
  async findByUserId(
    @Query('userId') userId: string,
    @Query() query?: EventsPaginatedQueryDto,
  ): Promise<Event[] | EventsResponseDto> {
    if (query && (query.page !== undefined || query.limit !== undefined)) {
      return this.eventsService.findByUserIdPaginated(userId, query);
    }
    return this.eventsService.findByUserId(userId);
  }

  @Get('by-object')
  async findByObjectId(
    @Query('objectId') objectId: string,
    @Query() query?: EventsPaginatedQueryDto,
  ): Promise<Event[] | EventsResponseDto> {
    if (query && (query.page !== undefined || query.limit !== undefined)) {
      return this.eventsService.findByObjectIdPaginated(objectId, query);
    }
    return this.eventsService.findByObjectId(objectId);
  }
}
