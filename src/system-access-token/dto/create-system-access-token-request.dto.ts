import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

@InputType()
export class CreateSystemAccessTokenRequestDto {
  @ApiProperty({ description: 'Maximum number of requests allowed' })
  @Field(() => Int)
  @IsInt()
  @Min(1)
  maxRequests: number;

  @ApiProperty({ required: false, description: 'Optional description' })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
