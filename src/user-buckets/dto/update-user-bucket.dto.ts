import { InputType, PartialType } from '@nestjs/graphql';
import { CreateUserBucketDto } from './create-user-bucket.dto';

@InputType()
export class UpdateUserBucketDto extends PartialType(CreateUserBucketDto) {}
