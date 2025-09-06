import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../../entities/user.entity';

@ObjectType()
export class SystemAccessTokenDto {
  @Field()
  id: string;

  @Field()
  maxCalls: number;

  @Field()
  calls: number;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @Field(() => User, { nullable: true })
  requester?: User;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  rawToken?: string;
}
