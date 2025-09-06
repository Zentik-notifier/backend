import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
}
