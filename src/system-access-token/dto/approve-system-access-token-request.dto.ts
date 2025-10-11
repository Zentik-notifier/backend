import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class ApproveSystemAccessTokenRequestDto {
  @ApiProperty({ required: false, description: 'Optional expiration date' })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}
