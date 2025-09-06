import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Bucket } from '../entities/bucket.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { User } from '../entities/user.entity';
import { EventsModule } from '../events/events.module';
import { UserBucketsController } from './user-buckets.controller';
import { UserBucketsResolver } from './user-buckets.resolver';
import { UserBucketsService } from './user-buckets.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserBucket, User, Bucket]), AuthModule, EventsModule],
  controllers: [UserBucketsController],
  providers: [UserBucketsService, UserBucketsResolver],
  exports: [UserBucketsService],
})
export class UserBucketsModule {}
