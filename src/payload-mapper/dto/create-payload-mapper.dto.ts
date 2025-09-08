import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreatePayloadMapperDto {
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field()
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field()
  @ApiProperty({
    description: 'JavaScript function as stringified code for payload mapping',
  })
  @IsNotEmpty()
  @IsString()
  jsEvalFn: string;
}
