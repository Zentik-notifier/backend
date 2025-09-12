import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Bucket } from '../entities/bucket.entity';
import { BucketsService } from './buckets.service';
import { CreateBucketDto, UpdateBucketDto } from './dto';

@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
@ApiTags('Buckets')
@Controller('buckets')
export class BucketsController {
  constructor(private readonly bucketsService: BucketsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new bucket with optional device associations',
  })
  @ApiResponse({
    status: 201,
    description: 'Bucket created successfully',
    type: Bucket,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'One or more devices not found' })
  create(
    @GetUser('id') userId: string,
    @Body() createBucketDto: CreateBucketDto,
  ) {
    return this.bucketsService.create(userId, createBucketDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all buckets for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of buckets', type: [Bucket] })
  findAll(@GetUser('id') userId: string) {
    return this.bucketsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific bucket by ID' })
  @ApiResponse({ status: 200, description: 'Bucket details', type: Bucket })
  @ApiResponse({ status: 404, description: 'Bucket not found' })
  findOne(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.bucketsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bucket and its device associations' })
  @ApiResponse({
    status: 200,
    description: 'Bucket updated successfully',
    type: Bucket,
  })
  @ApiResponse({
    status: 404,
    description: 'Bucket not found or one or more devices not found',
  })
  update(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() updateBucketDto: UpdateBucketDto,
  ) {
    return this.bucketsService.update(id, userId, updateBucketDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bucket' })
  @ApiResponse({ status: 200, description: 'Bucket deleted successfully' })
  @ApiResponse({ status: 404, description: 'Bucket not found' })
  remove(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.bucketsService.remove(id, userId);
  }

  @Get(':id/notifications/count')
  @ApiOperation({ summary: 'Get the count of notifications for a bucket' })
  @ApiResponse({
    status: 200,
    description: 'Notification count',
    schema: { type: 'object', properties: { count: { type: 'number' } } },
  })
  @ApiResponse({ status: 404, description: 'Bucket not found' })
  getNotificationsCount(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ) {
    return this.bucketsService.getNotificationsCount(id, userId);
  }

  @Post(':id/upload-icon')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload bucket icon' })
  @ApiResponse({
    status: 200,
    description: 'Icon uploaded successfully',
    type: Bucket,
  })
  @ApiResponse({
    status: 404,
    description: 'Bucket not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or file too large',
  })
  uploadIcon(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    return this.bucketsService.uploadIcon(id, userId, file);
  }
}
