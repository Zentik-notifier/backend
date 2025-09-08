import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdatePayloadMapperDto {
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'JavaScript function as stringified code for payload mapping',
    required: false,
  })
  @IsOptional()
  @IsString()
  jsEvalFn?: string;
}
