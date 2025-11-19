import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { EntityExecution, ExecutionType } from '../entities';
import { EntityExecutionService } from './entity-execution.service';
import { GetEntityExecutionsInput } from './dto/entity-execution.dto';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';

@Resolver(() => EntityExecution)
@UseGuards(JwtOrAccessTokenGuard)
@Injectable()
export class EntityExecutionsResolver {
  constructor(private entityExecutionService: EntityExecutionService) {}

  @Query(() => EntityExecution, { nullable: true })
  async entityExecution(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<EntityExecution | null> {
    return this.entityExecutionService.findById(id, userId);
  }

  @Query(() => [EntityExecution])
  async getEntityExecutions(
    @Args('input') input: GetEntityExecutionsInput,
    @CurrentUser('id') userId: string,
  ): Promise<EntityExecution[]> {
    // Always use the authenticated user's ID, ignore input.userId for security
    // If no filters provided, return all executions for the user
    if (!input.type && !input.entityId) {
      return this.entityExecutionService.findByUserId(userId);
    }

    // If type is provided, use the method that supports entityId filtering
    if (input.type) {
      return this.entityExecutionService.findByTypeAndEntity(
        input.type,
        input.entityId,
        undefined,
        userId, // Always use authenticated user's ID
      );
    }

    // If only entityId is provided, filter by entityId and userId
    if (input.entityId) {
      return this.entityExecutionService.findByTypeAndEntity(
        ExecutionType.PAYLOAD_MAPPER, // Default to PAYLOAD_MAPPER if no type specified
        input.entityId,
        undefined,
        userId, // Always use authenticated user's ID
      );
    }

    // Fallback to current user executions
    return this.entityExecutionService.findByUserId(userId);
  }
}
