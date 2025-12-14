import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ChangelogEntryInput, CreateChangelogInput } from './create-changelog.dto';

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

  @Field(() => Boolean, { nullable: true })
  @ApiPropertyOptional({ description: 'Whether this changelog is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @Field(() => [ChangelogEntryInput], { nullable: true })
  @ApiPropertyOptional({
    description: 'Structured changelog entries',
    type: () => [ChangelogEntryInput],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangelogEntryInput)
  entries?: ChangelogEntryInput[];
}
