import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BucketPermissionsDto {
  @Field(() => Boolean, { description: 'User can write to this bucket' })
  canWrite: boolean;

  @Field(() => Boolean, { description: 'User can delete this bucket' })
  canDelete: boolean;

  @Field(() => Boolean, { description: 'User can administer this bucket' })
  canAdmin: boolean;

  @Field(() => Boolean, { description: 'User can read from this bucket' })
  canRead: boolean;

  @Field(() => Boolean, { description: 'User is the owner of this bucket' })
  isOwner: boolean;

  @Field(() => Boolean, { description: 'Bucket is shared with this user' })
  isSharedWithMe: boolean;

  @Field(() => Int, { description: 'Number of users this bucket is shared with' })
  sharedCount: number;
}

