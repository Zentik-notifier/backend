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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { UserBucket } from '../entities/user-bucket.entity';
import { User } from '../entities/user.entity';
import { CreateUserBucketDto, UpdateUserBucketDto } from './dto';
import { UserBucketsService } from './user-buckets.service';

@ApiTags('User Buckets')
@Controller('user-buckets')
@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
export class UserBucketsController {
  constructor(private readonly userBucketsService: UserBucketsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user bucket relationship' })
  @ApiResponse({
    status: 201,
    description: 'User bucket created successfully',
    type: UserBucket,
  })
  @ApiResponse({
    status: 409,
    description: 'User bucket relationship already exists',
  })
  create(
    @Body() createUserBucketDto: CreateUserBucketDto,
    @CurrentUser() user: User,
  ) {
    return this.userBucketsService.create(user.id, createUserBucketDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user buckets for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of user buckets',
    type: [UserBucket],
  })
  findAll(@CurrentUser() user: User) {
    return this.userBucketsService.findAllByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific user bucket by ID' })
  @ApiResponse({
    status: 200,
    description: 'User bucket found',
    type: UserBucket,
  })
  @ApiResponse({ status: 404, description: 'User bucket not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.userBucketsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user bucket' })
  @ApiResponse({
    status: 200,
    description: 'User bucket updated successfully',
    type: UserBucket,
  })
  @ApiResponse({ status: 404, description: 'User bucket not found' })
  update(
    @Param('id') id: string,
    @Body() updateUserBucketDto: UpdateUserBucketDto,
    @CurrentUser() user: User,
  ) {
    return this.userBucketsService.update(id, user.id, updateUserBucketDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user bucket' })
  @ApiResponse({ status: 200, description: 'User bucket deleted successfully' })
  @ApiResponse({ status: 404, description: 'User bucket not found' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.userBucketsService.remove(id, user.id);
  }

  @Get('bucket/:bucketId/snooze-status')
  @ApiOperation({
    summary: 'Check if a bucket is snoozed for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Snooze status',
    schema: { type: 'boolean' },
  })
  getSnoozeStatus(
    @Param('bucketId') bucketId: string,
    @CurrentUser() user: User,
  ) {
    return this.userBucketsService.isSnoozed(bucketId, user.id);
  }

  @Post('bucket/:bucketId/snooze')
  @ApiOperation({ summary: 'Set bucket snooze for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Bucket snooze set successfully',
    type: UserBucket,
  })
  @ApiResponse({
    status: 201,
    description: 'Bucket snooze created successfully',
    type: UserBucket,
  })
  setBucketSnooze(
    @Param('bucketId') bucketId: string,
    @Body('snoozeUntil') snoozeUntil: string | null,
    @CurrentUser() user: User,
  ) {
    return this.userBucketsService.setBucketSnooze(
      bucketId,
      user.id,
      snoozeUntil,
    );
  }

  @Get('snoozed-bucket-ids')
  @ApiOperation({ summary: 'Get all snoozed bucket IDs for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of snoozed bucket IDs',
    type: [String],
  })
  getSnoozedBucketIds(@CurrentUser() user: User) {
    return this.userBucketsService.getSnoozedBucketIds(user.id);
  }
}
