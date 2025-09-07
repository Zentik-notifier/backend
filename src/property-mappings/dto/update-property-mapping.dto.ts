import { Field, InputType, PartialType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { CreatePropertyMappingDto } from './create-property-mapping.dto';

@InputType()
export class UpdatePropertyMappingDto extends PartialType(CreatePropertyMappingDto) {
  @Field({ nullable: true })
  @ApiProperty({ example: 'My Updated Property Mapping', required: false })
  name?: string;

  @Field({ nullable: true })
  @ApiProperty({ example: 'Updated description of the property mapping', required: false })
  description?: string;
}