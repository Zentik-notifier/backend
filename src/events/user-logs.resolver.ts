import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { UserLog } from '../entities';
import { CreateUserLogInput } from './dto/create-user-log.dto';
import { UserLogsService } from './user-logs.service';
import {
  GetUserLogsInput,
  PaginatedUserLogs,
} from './dto/get-user-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';

@Resolver(() => UserLog)
@Injectable()
export class UserLogsResolver {
  constructor(private readonly userLogsService: UserLogsService) {}

  @Mutation(() => UserLog)
  async createUserLog(
    @Args('input') input: CreateUserLogInput,
    @CurrentUser('id') userId: string | undefined,
  ): Promise<UserLog> {
    return this.userLogsService.createUserLog(userId, input);
  }

  @Query(() => PaginatedUserLogs, {
    name: 'userLogs',
    description: 'Get user logs with pagination and filtering',
  })
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  async getUserLogs(
    @Args('input') input: GetUserLogsInput,
  ): Promise<PaginatedUserLogs> {
    return this.userLogsService.getUserLogs(input);
  }
}


