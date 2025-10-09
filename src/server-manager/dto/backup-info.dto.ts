import { Field, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

@ObjectType()
export class BackupInfoDto {
  @Field()
  @ApiProperty({ description: 'The filename of the backup' })
  filename: string;

  @Field()
  @ApiProperty({ description: 'The full path of the backup file' })
  path: string;

  @Field()
  @ApiProperty({ description: 'The size of the backup file in human-readable format' })
  size: string;

  @Field()
  @ApiProperty({ description: 'The size of the backup file in bytes' })
  sizeBytes: number;

  @Field()
  @ApiProperty({ description: 'The creation date of the backup' })
  createdAt: Date;
}
