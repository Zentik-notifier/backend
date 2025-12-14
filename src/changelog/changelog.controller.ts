import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { Changelog } from '../entities/changelog.entity';
import { ChangelogService } from './changelog.service';
import { CreateChangelogInput, UpdateChangelogInput } from './dto';

@ApiTags('Changelog')
@Controller('changelogs')
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  // Public endpoints for reading changelogs
  @Get()
  async findAll(): Promise<Changelog[]> {
    return this.changelogService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Changelog> {
    return this.changelogService.findOne(id);
  }

  // Admin-only endpoint to fetch all changelogs (including inactive)
  @Get('admin/all')
  @UseGuards(AdminOnlyGuard)
  @ApiBearerAuth()
  async findAllAdmin(): Promise<Changelog[]> {
    return this.changelogService.findAllAdmin();
  }

  // Admin-only endpoints for managing changelogs
  @Post()
  @UseGuards(AdminOnlyGuard)
  @ApiBearerAuth()
  async create(@Body() input: CreateChangelogInput): Promise<Changelog> {
    return this.changelogService.create(input);
  }

  @Patch(':id')
  @UseGuards(AdminOnlyGuard)
  @ApiBearerAuth()
  async update(
    @Param('id') id: string,
    @Body() input: Omit<UpdateChangelogInput, 'id'>,
  ): Promise<Changelog> {
    return this.changelogService.update({ ...input, id });
  }

  @Delete(':id')
  @UseGuards(AdminOnlyGuard)
  @ApiBearerAuth()
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.changelogService.remove(id);
    return { success };
  }
}
