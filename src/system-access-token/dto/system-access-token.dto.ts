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

  @Field()
  totalCalls: number;

  @Field()
  failedCalls: number;

  @Field()
  totalFailedCalls: number;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @Field(() => Date, { nullable: true })
  lastResetAt?: Date;

  @Field(() => User, { nullable: true })
  requester?: User;

  @Field({ nullable: true })
  description?: string;

  @Field(() => [String], { nullable: true })
  scopes?: string[];

  @Field({ nullable: true })
  token?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  rawToken?: string;
}
