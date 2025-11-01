import { UseGuards } from '@nestjs/common';
import { Resolver, ResolveField, Parent, Mutation, Args } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBucket } from '../entities/user-bucket.entity';
import { User } from '../entities/user.entity';
import { Bucket } from '../entities/bucket.entity';
import { BucketsService } from './buckets.service';
import { CurrentUser } from '../graphql/decorators/current-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';

@Resolver(() => UserBucket)
@UseGuards(JwtOrAccessTokenGuard)
export class UserBucketResolver {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Bucket)
    private readonly bucketsRepository: Repository<Bucket>,
    private readonly bucketsService: BucketsService,
  ) {}

  @ResolveField(() => User)
  async user(@Parent() userBucket: UserBucket) {
    if (userBucket.user) return userBucket.user; // already loaded
    return this.usersRepository.findOne({ where: { id: userBucket.userId } });
  }

  @ResolveField(() => Bucket)
  async bucket(@Parent() userBucket: UserBucket) {
    if (userBucket.bucket) return userBucket.bucket;
    return this.bucketsRepository.findOne({
      where: { id: userBucket.bucketId },
    });
  }

  @Mutation(() => UserBucket)
  async regenerateMagicCode(
    @Args('bucketId') bucketId: string,
    @CurrentUser('id') userId: string,
  ): Promise<UserBucket> {
    return this.bucketsService.regenerateMagicCode(userId, bucketId);
  }
}
