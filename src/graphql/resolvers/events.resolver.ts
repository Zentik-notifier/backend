import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../../auth/guards/admin-only.guard';
import { Event, EventType } from '../../entities';
import { EventsService } from '../../events/events.service';
import { JwtOrAccessTokenGuard } from 'src/auth/guards/jwt-or-access-token.guard';

@Resolver(() => Event)
@UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
export class EventsResolver {
  constructor(private readonly eventsService: EventsService) { }

  @Query(() => [Event])
  async events(): Promise<Event[]> {
    return this.eventsService.findAll();
  }

  @Query(() => Number)
  async eventCount(): Promise<number> {
    return this.eventsService.getEventCount();
  }

  @Query(() => [Event])
  async eventsByType(
    @Args('type', { type: () => EventType }) type: EventType,
  ): Promise<Event[]> {
    return this.eventsService.findByType(type);
  }

  @Query(() => [Event])
  async eventsByUser(@Args('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findByUserId(userId);
  }

  @Query(() => [Event])
  async eventsByObject(@Args('objectId') objectId: string): Promise<Event[]> {
    return this.eventsService.findByObjectId(objectId);
  }
}
