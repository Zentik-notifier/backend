import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

@InputType()
export class ChangelogEntryInput {
    @Field(() => String)
    @ApiProperty({ description: 'Entry type', example: 'feature' })
    @IsString()
    type: string;

    @Field(() => String)
    @ApiProperty({ description: 'Entry text' })
    @IsString()
    text: string;
}

@InputType()
export class CreateChangelogInput {
    @Field(() => String, { nullable: true })
    @ApiPropertyOptional({ description: 'iOS app version', required: false })
    @IsOptional()
    @IsString()
    iosVersion?: string;

    @Field(() => String, { nullable: true })
    @ApiPropertyOptional({ description: 'Android app version', required: false })
    @IsOptional()
    @IsString()
    androidVersion?: string;

    @Field(() => String, { nullable: true })
    @ApiPropertyOptional({ description: 'Web/UI version', required: false })
    @IsOptional()
    @IsString()
    uiVersion?: string;

    @Field(() => String, { nullable: true })
    @ApiPropertyOptional({ description: 'Backend/server version', required: false })
    @IsOptional()
    @IsString()
    backendVersion?: string;

    @Field(() => String)
    @ApiProperty({ description: 'Combined changelog description' })
    @IsString()
    @IsNotEmpty()
    description: string;

        @Field(() => Boolean, { nullable: true })
        @ApiPropertyOptional({ description: 'Whether this changelog is active', default: true })
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
