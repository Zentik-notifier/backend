import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { GraphQLJSON } from '../../common/types/json.type';
import { EventType } from '../../entities';

@InputType()
export class CreateEventDto {
  @Field(() => EventType)
  @IsEnum(EventType)
  type: EventType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  objectId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetId?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @IsObject()
  additionalInfo?: Record<string, any>;
}
