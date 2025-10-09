import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { LogOutput } from '../entities/log-output.entity';
import { LogOutputsService } from './log-outputs.service';
import { CreateLogOutputDto, UpdateLogOutputDto } from './dto/log-output.dto';

@ApiTags('Log Outputs')
@Controller('log-outputs')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class LogOutputsController {
  constructor(private readonly logOutputsService: LogOutputsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all log output configurations' })
  @ApiResponse({
    status: 200,
    description: 'List of log outputs',
    type: [LogOutput],
  })
  async findAll(): Promise<LogOutput[]> {
    return this.logOutputsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific log output by ID' })
  @ApiResponse({
    status: 200,
    description: 'Log output details',
    type: LogOutput,
  })
  @ApiResponse({ status: 404, description: 'Log output not found' })
  async findOne(@Param('id') id: string): Promise<LogOutput> {
    return this.logOutputsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new log output configuration' })
  @ApiResponse({
    status: 201,
    description: 'Log output created successfully',
    type: LogOutput,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() dto: CreateLogOutputDto): Promise<LogOutput> {
    return this.logOutputsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing log output' })
  @ApiResponse({
    status: 200,
    description: 'Log output updated successfully',
    type: LogOutput,
  })
  @ApiResponse({ status: 404, description: 'Log output not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLogOutputDto,
  ): Promise<LogOutput> {
    return this.logOutputsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a log output configuration' })
  @ApiResponse({
    status: 200,
    description: 'Log output deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Log output not found' })
  async remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
    const deleted = await this.logOutputsService.remove(id);
    return { deleted };
  }
}
