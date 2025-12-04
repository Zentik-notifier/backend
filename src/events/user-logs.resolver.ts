import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { UserLog } from '../entities';
import { CreateUserLogInput } from './dto/create-user-log.dto';
import { UserLogsService } from './user-logs.service';

@Resolver(() => UserLog)
@UseGuards(JwtOrAccessTokenGuard)
@Injectable()
export class UserLogsResolver {
  constructor(private readonly userLogsService: UserLogsService) {}

  @Mutation(() => UserLog)
  async createUserLog(
    @Args('input') input: CreateUserLogInput,
    @CurrentUser('id') userId: string,
  ): Promise<UserLog> {
    return this.userLogsService.createUserLog(userId, input);
  }
}


