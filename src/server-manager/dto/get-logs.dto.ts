import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Log, LogLevel } from '../../entities/log.entity';

@InputType()
export class GetLogsInput {
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

  @Field(() => LogLevel, { nullable: true })
  @ApiProperty({ enum: LogLevel, required: false })
  @IsEnum(LogLevel)
  @IsOptional()
  level?: LogLevel;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  context?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;
}

@ObjectType()
export class PaginatedLogs {
  @Field(() => [Log])
  @ApiProperty({ type: [Log] })
  logs: Log[];

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
