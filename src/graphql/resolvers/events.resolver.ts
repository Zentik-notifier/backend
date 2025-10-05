import { UseGuards, ForbiddenException } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../../auth/guards/admin-only.guard';
import { Event } from '../../entities';
import { EventsService } from '../../events/events.service';
import {
  EventsQueryDto,
  EventsResponseDto,
  EventsPaginatedQueryDto,
} from '../../events/dto';
import { JwtOrAccessTokenGuard } from 'src/auth/guards/jwt-or-access-token.guard';

@Resolver(() => Event)
@UseGuards(JwtOrAccessTokenGuard, AdminOnlyGuard)
export class EventsResolver {
  constructor(private readonly eventsService: EventsService) {}

  @Query(() => EventsResponseDto)
  async events(
    @Args('query') query: EventsQueryDto,
  ): Promise<EventsResponseDto> {
    return this.eventsService.findAllPaginated(query);
  }
}
