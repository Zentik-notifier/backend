import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ExecutionType } from '../../entities';

@InputType()
export class GetEntityExecutionsInput {
  @Field(() => ExecutionType, { nullable: true })
  @ApiProperty({
    enum: ExecutionType,
    required: false,
    description: 'Type of execution to filter by',
  })
  @IsOptional()
  @IsEnum(ExecutionType)
  type?: ExecutionType;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'UUID of the entity to filter by',
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'User ID to filter by',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
