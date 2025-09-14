import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthModule } from '../auth/auth.module';
import { Bucket } from '../entities/bucket.entity';
import { User } from '../entities/user.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { EventsModule } from '../events/events.module';
import { BucketsController } from './buckets.controller';
import { BucketsService } from './buckets.service';
import { UserBucketResolver } from './user-bucket.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bucket, User, UserBucket]),
    AuthModule,
    EntityPermissionModule,
    EventsModule,
    AttachmentsModule,
  ],
  controllers: [BucketsController],
  providers: [BucketsService, UserBucketResolver],
  exports: [BucketsService],
})
export class BucketsModule {}
