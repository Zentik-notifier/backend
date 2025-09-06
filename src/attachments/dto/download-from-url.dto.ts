import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';
import { MediaType } from '../../notifications/notifications.types';

@InputType()
export class DownloadFromUrlDto {
  @Field()
  @ApiProperty({ description: 'The URL to download the attachment from' })
  @IsUrl()
  url: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'The filename for the downloaded attachment',
  })
  @IsOptional()
  @IsString()
  filename?: string;

  @Field(() => MediaType, { nullable: true })
  @ApiProperty({
    enum: MediaType,
    required: false,
    description: 'The media type of the attachment',
  })
  @IsOptional()
  mediaType?: MediaType;
}
