import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventType } from '../entities';
import { CreateEventDto } from './dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
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
}
