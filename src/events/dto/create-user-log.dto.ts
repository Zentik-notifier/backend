import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { GraphQLJSON } from '../../common/types/json.type';
import { UserLogType } from '../../entities';

@InputType()
export class CreateUserLogInput {
  @Field(() => UserLogType)
  @IsEnum(UserLogType)
  type: UserLogType;

  @Field(() => GraphQLJSON)
  @IsObject()
  payload: Record<string, any>;

  /**
   * Optional userId. If omitted, the current authenticated user will be used.
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;
}


