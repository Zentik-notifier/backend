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
import { UserBucketsService } from './user-buckets.service';

@ApiTags('User Buckets')
@Controller('user-buckets')
@UseGuards(JwtOrAccessTokenGuard)
@ApiBearerAuth()
export class UserBucketsController {
  constructor(private readonly userBucketsService: UserBucketsService) {}

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
}
