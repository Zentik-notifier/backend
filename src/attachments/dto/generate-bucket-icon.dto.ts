import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsHexColor, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateBucketIconDto {
  @ApiProperty({
    description: 'Bucket name for generating initials',
    example: 'My Bucket',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  bucketName: string;

  @ApiProperty({
    description: 'Bucket color in hex format',
    example: '#007AFF',
    required: false,
  })
  @IsOptional()
  @IsHexColor()
  bucketColor?: string;

  @ApiProperty({
    description: 'Whether to include initials in the generated icon',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeInitials?: boolean;
}

