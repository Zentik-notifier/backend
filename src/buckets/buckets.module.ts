import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Bucket } from '../entities/bucket.entity';
import { User } from '../entities/user.entity';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { UserBucketsModule } from '../user-buckets/user-buckets.module';
import { BucketsController } from './buckets.controller';
import { BucketsService } from './buckets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bucket, User]),
    AuthModule,
    EntityPermissionModule,
    UserBucketsModule,
  ],
  controllers: [BucketsController],
  providers: [BucketsService],
  exports: [BucketsService],
})
export class BucketsModule {}
