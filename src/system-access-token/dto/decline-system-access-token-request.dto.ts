import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class DeclineSystemAccessTokenRequestDto {
  @ApiProperty({ required: false, description: 'Optional reason for declining' })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}
