import { UseGuards } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Bucket } from '../entities/bucket.entity';
import { UserBucket } from '../entities/user-bucket.entity';
import { User } from '../entities/user.entity';
import {
  CreateUserBucketDto,
  SnoozeScheduleInput,
  UpdateUserBucketDto,
} from './dto';
import { UserBucketsService } from './user-buckets.service';

@Resolver(() => UserBucket)
@UseGuards(JwtOrAccessTokenGuard)
export class UserBucketsResolver {
  constructor(
    private readonly userBucketsService: UserBucketsService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Bucket)
    private readonly bucketsRepository: Repository<Bucket>,
  ) { }

  @Mutation(() => UserBucket)
  async setBucketSnooze(
    @Args('bucketId', { type: () => String }) bucketId: string,
    @Args('snoozeUntil', { type: () => String, nullable: true })
    snoozeUntil: string | null,
    @CurrentUser() user: User,
  ) {
    return this.userBucketsService.setBucketSnooze(
      bucketId,
      user.id,
      snoozeUntil,
    );
  }

  @Mutation(() => UserBucket)
  async updateBucketSnoozes(
    @Args('bucketId', { type: () => String }) bucketId: string,
    @Args('snoozes', { type: () => [SnoozeScheduleInput] })
    snoozes: SnoozeScheduleInput[],
    @CurrentUser() user: User,
  ) {
    return this.userBucketsService.updateBucketSnoozes(
      bucketId,
      user.id,
      snoozes,
    );
  }

  @Query(() => Boolean, { name: 'isBucketSnoozed' })
  getSnoozeStatus(
    @Args('bucketId', { type: () => String }) bucketId: string,
    @CurrentUser() user: User,
  ) {
    return this.userBucketsService.isSnoozed(bucketId, user.id);
  }

  @ResolveField(() => User)
  async user(@Parent() userBucket: UserBucket) {
    // Fetch full user to avoid null non-nullable fields
    return this.usersRepository.findOne({ where: { id: userBucket.userId } });
  }

  @ResolveField(() => Bucket)
  async bucket(@Parent() userBucket: UserBucket) {
    return this.bucketsRepository.findOne({
      where: { id: userBucket.bucketId },
    });
  }
}
