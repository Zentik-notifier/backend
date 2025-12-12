import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
