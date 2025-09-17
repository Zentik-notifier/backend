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
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Bucket } from '../entities/bucket.entity';
import { BucketsService } from './buckets.service';
import { CreateBucketDto, UpdateBucketDto } from './dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

class SetBucketSnoozeDto {
  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    example: '2025-09-14T12:34:56.000Z',
    description: 'ISO date until which notifications are snoozed. Null to clear snooze.',
  })
  snoozeUntil?: string | null;
}

class SetBucketSnoozeMinutesDto {
  @ApiProperty({
    type: Number,
    example: 60,
    description: 'Number of minutes to snooze the bucket from now',
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  minutes: number;
}

@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
@ApiTags('Buckets')
@Controller('buckets')
export class BucketsController {
  constructor(private readonly bucketsService: BucketsService) { }

  @Post()
  @ApiOperation({
    summary: 'Create a new bucket',
  })
  @ApiResponse({
    status: 201,
    description: 'Bucket created successfully',
    type: Bucket,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
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
  @ApiOperation({ summary: 'Update a bucket' })
  @ApiResponse({
    status: 200,
    description: 'Bucket updated successfully',
    type: Bucket,
  })
  @ApiResponse({
    status: 404,
    description: 'Bucket not found',
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

  @Get(':id/snooze-status')
  @ApiOperation({
    summary: 'Check if a bucket is snoozed for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Snooze status',
    schema: { type: 'boolean' },
  })
  getSnoozeStatus(
    @Param('id') bucketId: string,
    @GetUser('id') userId: string,
  ) {
    return this.bucketsService.isBucketSnoozed(bucketId, userId);
  }

  @Post(':id/snooze')
  @ApiOperation({
    summary: 'Set bucket snooze for the current user',
    description: 'Pass a JSON body {"snoozeUntil": "<ISO date>"}. Use null or omit the field to clear.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bucket snooze updated successfully',
  })
  @ApiResponse({
    status: 201,
    description: 'Bucket snooze created successfully',
  })
  setBucketSnooze(
    @Param('id') bucketId: string,
    @Body() body: SetBucketSnoozeDto,
    @GetUser('id') userId: string,
  ) {
    return this.bucketsService.setBucketSnooze(bucketId, userId, body?.snoozeUntil ?? null);
  }

  @Post(':id/snooze-minutes')
  @ApiOperation({
    summary: 'Set bucket snooze using minutes from now',
    description: 'Snooze bucket for specified number of minutes from current time',
  })
  @ApiResponse({
    status: 200,
    description: 'Bucket snooze updated successfully',
  })
  @ApiResponse({
    status: 201,
    description: 'Bucket snooze created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid minutes value',
  })
  setBucketSnoozeMinutes(
    @Param('id') bucketId: string,
    @Body() body: SetBucketSnoozeMinutesDto,
    @GetUser('id') userId: string,
  ) {
    return this.bucketsService.setBucketSnoozeMinutes(bucketId, userId, body.minutes);
  }

}
