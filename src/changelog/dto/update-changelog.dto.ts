import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CreateChangelogInput } from './create-changelog.dto';

@InputType()
export class UpdateChangelogInput extends PartialType(CreateChangelogInput) {
  @Field(() => ID)
  @ApiProperty({ description: 'Changelog identifier' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  iosVersion?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  androidVersion?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  uiVersion?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  backendVersion?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
