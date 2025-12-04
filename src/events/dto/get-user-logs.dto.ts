import { Field, InputType, Int, ObjectType, ID } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserLogType } from '../../entities';
import { GraphQLJSON } from '../../common/types/json.type';

@ObjectType()
export class UserLogEntry {
  @Field(() => ID)
  @ApiProperty()
  id: string;

  @Field(() => UserLogType)
  @ApiProperty({ enum: UserLogType })
  type: UserLogType;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false })
  userId?: string | null;

  @Field(() => GraphQLJSON)
  @ApiProperty()
  payload: Record<string, any>;

  @Field()
  @ApiProperty()
  createdAt: Date;
}

@InputType()
export class GetUserLogsInput {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @ApiProperty({ required: false, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 50 })
  @ApiProperty({ required: false, default: 50 })
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit?: number;

  @Field(() => UserLogType, { nullable: true })
  @ApiProperty({ enum: UserLogType, required: false })
  @IsEnum(UserLogType)
  @IsOptional()
  type?: UserLogType;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;
}

@ObjectType()
export class PaginatedUserLogs {
  @Field(() => [UserLogEntry])
  @ApiProperty({ type: [UserLogEntry] })
  logs: UserLogEntry[];

  @Field(() => Int)
  @ApiProperty()
  total: number;

  @Field(() => Int)
  @ApiProperty()
  page: number;

  @Field(() => Int)
  @ApiProperty()
  limit: number;

  @Field(() => Int)
  @ApiProperty()
  totalPages: number;
}


