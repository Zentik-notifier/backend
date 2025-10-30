import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class MobileAppleAuthDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Apple identity token (JWT)', required: true })
  @Field(() => String)
  identityToken: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Opaque Apple payload (stringified JSON)', required: true })
  @Field(() => String)
  payload: string;

  // Optional device info to enrich the created session (shared by REST and GraphQL)
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  @Field(() => String, { nullable: true })
  deviceName?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Device platform (IOS/ANDROID/WEB)' })
  @Field(() => String, { nullable: true })
  platform?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  @Field(() => String, { nullable: true })
  osVersion?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  @Field(() => String, { nullable: true })
  browser?: string;
}


