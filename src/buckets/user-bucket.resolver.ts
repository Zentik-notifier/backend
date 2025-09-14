import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBucket } from '../entities/user-bucket.entity';
import { User } from '../entities/user.entity';
import { Bucket } from '../entities/bucket.entity';

// Minimal resolver to resolve nested relations for UserBucket after removing legacy module
@Resolver(() => UserBucket)
export class UserBucketResolver {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Bucket) private readonly bucketsRepository: Repository<Bucket>,
  ) {}

  @ResolveField(() => User)
  async user(@Parent() userBucket: UserBucket) {
    if (userBucket.user) return userBucket.user; // already loaded
    return this.usersRepository.findOne({ where: { id: userBucket.userId } });
  }

  @ResolveField(() => Bucket)
  async bucket(@Parent() userBucket: UserBucket) {
    if (userBucket.bucket) return userBucket.bucket;
    return this.bucketsRepository.findOne({ where: { id: userBucket.bucketId } });
  }
}
