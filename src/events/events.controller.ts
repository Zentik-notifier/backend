import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { Event, EventType } from '../entities';
import { EventsService } from './events.service';

@ApiTags('Events')
@Controller('events')
@UseGuards(AdminOnlyGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll(): Promise<Event[]> {
    return this.eventsService.findAll();
  }

  @Get('count')
  async getEventCount(): Promise<{ count: number }> {
    const count = await this.eventsService.getEventCount();
    return { count };
  }

  @Get('by-type')
  async findByType(@Query('type') type: EventType): Promise<Event[]> {
    return this.eventsService.findByType(type);
  }

  @Get('by-user')
  async findByUserId(@Query('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findByUserId(userId);
  }

  @Get('by-object')
  async findByObjectId(@Query('objectId') objectId: string): Promise<Event[]> {
    return this.eventsService.findByObjectId(objectId);
  }
}
