import { Field, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

@ObjectType()
export class FileInfoDto {
  @Field()
  @ApiProperty()
  name: string;

  @Field()
  @ApiProperty()
  size: number;

  @Field()
  @ApiProperty()
  mtime: Date;

  @Field()
  @ApiProperty({ description: 'Whether the entry is a directory' })
  isDir: boolean;
}


