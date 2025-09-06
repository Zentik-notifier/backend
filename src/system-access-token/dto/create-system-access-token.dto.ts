import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateSystemAccessTokenDto {
  @Field()
  @IsNumber()
  maxCalls: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  expiresAt?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  requesterId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
