import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class PropertyMappingItemInput {
  @Field()
  @ApiProperty({ example: 'user.name' })
  @IsString()
  @IsNotEmpty()
  sourceBuild: string;

  @Field()
  @ApiProperty({ example: 'fullName' })
  @IsString()
  @IsNotEmpty()
  targetKey: string;
}

@InputType()
export class CreatePropertyMappingDto {
  @Field()
  @ApiProperty({ example: 'My Property Mapping' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field({ nullable: true })
  @ApiProperty({ example: 'Description of the property mapping', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => [PropertyMappingItemInput])
  @ApiProperty({ 
    type: [PropertyMappingItemInput],
    example: [
      { sourceBuild: 'user.name', targetKey: 'fullName' },
      { sourceBuild: 'user.email', targetKey: 'emailAddress' }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyMappingItemInput)
  properties: PropertyMappingItemInput[];

  @Field(() => Object, { nullable: true })
  @ApiProperty({ 
    example: { 
      user: { name: 'John Doe', email: 'john@example.com' },
      timestamp: '2024-01-01T00:00:00.000Z'
    },
    required: false 
  })
  @IsOptional()
  samplePayload?: any;
}