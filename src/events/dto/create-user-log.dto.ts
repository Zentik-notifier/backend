import { Field, InputType } from '@nestjs/graphql';
import { GraphQLJSON } from '../../common/types/json.type';
import { UserLogType } from '../../entities';

@InputType()
export class CreateUserLogInput {
  @Field(() => UserLogType)
  type: UserLogType;

  @Field(() => GraphQLJSON)
  payload: Record<string, any>;

  /**
   * Optional userId. If omitted, the current authenticated user will be used.
   */
  @Field({ nullable: true })
  userId?: string;
}


