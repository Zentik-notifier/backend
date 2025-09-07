import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PropertyMappingsService } from './property-mappings.service';
import { CreatePropertyMappingDto, UpdatePropertyMappingDto } from './dto';
import { PropertyMapping } from '../entities/property-mapping.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Property Mappings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('property-mappings')
export class PropertyMappingsController {
  constructor(private readonly propertyMappingsService: PropertyMappingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new property mapping' })
  @ApiResponse({ status: 201, description: 'Property mapping created successfully', type: PropertyMapping })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createPropertyMappingDto: CreatePropertyMappingDto, @Request() req) {
    return this.propertyMappingsService.create(createPropertyMappingDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all property mappings for the current user' })
  @ApiResponse({ status: 200, description: 'Property mappings retrieved successfully', type: [PropertyMapping] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Request() req) {
    return this.propertyMappingsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a property mapping by ID' })
  @ApiResponse({ status: 200, description: 'Property mapping retrieved successfully', type: PropertyMapping })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Property mapping not found' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.propertyMappingsService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a property mapping' })
  @ApiResponse({ status: 200, description: 'Property mapping updated successfully', type: PropertyMapping })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Property mapping not found' })
  update(@Param('id') id: string, @Body() updatePropertyMappingDto: UpdatePropertyMappingDto, @Request() req) {
    return this.propertyMappingsService.update(id, updatePropertyMappingDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a property mapping' })
  @ApiResponse({ status: 200, description: 'Property mapping deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Property mapping not found' })
  remove(@Param('id') id: string, @Request() req) {
    return this.propertyMappingsService.remove(id, req.user.id);
  }
}