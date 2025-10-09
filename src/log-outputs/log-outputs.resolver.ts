import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { LogOutput } from '../entities/log-output.entity';
import { LogOutputsService } from './log-outputs.service';
import { CreateLogOutputDto, UpdateLogOutputDto } from './dto/log-output.dto';

@Resolver(() => LogOutput)
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class LogOutputsResolver {
  constructor(private readonly logOutputsService: LogOutputsService) {}

  @Query(() => [LogOutput], {
    name: 'logOutputs',
    description: 'Get all log output configurations',
  })
  async getAllLogOutputs(): Promise<LogOutput[]> {
    return this.logOutputsService.findAll();
  }

  @Query(() => LogOutput, {
    name: 'logOutput',
    nullable: true,
    description: 'Get a specific log output by ID',
  })
  async getLogOutput(
    @Args('id', { type: () => String }) id: string,
  ): Promise<LogOutput> {
    return this.logOutputsService.findOne(id);
  }

  @Mutation(() => LogOutput, {
    name: 'createLogOutput',
    description: 'Create a new log output configuration',
  })
  async createLogOutput(
    @Args('input') dto: CreateLogOutputDto,
  ): Promise<LogOutput> {
    return this.logOutputsService.create(dto);
  }

  @Mutation(() => LogOutput, {
    name: 'updateLogOutput',
    description: 'Update an existing log output configuration',
  })
  async updateLogOutput(
    @Args('id', { type: () => String }) id: string,
    @Args('input') dto: UpdateLogOutputDto,
  ): Promise<LogOutput> {
    return this.logOutputsService.update(id, dto);
  }

  @Mutation(() => Boolean, {
    name: 'deleteLogOutput',
    description: 'Delete a log output configuration',
  })
  async deleteLogOutput(
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    return this.logOutputsService.remove(id);
  }
}
