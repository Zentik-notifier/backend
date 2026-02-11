import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { MediaType } from '../../notifications/notifications.types';

@InputType()
export class UploadAttachmentDto {
  @Field()
  @ApiProperty({ description: 'The filename of the attachment' })
  @IsString()
  filename: string;

  @Field(() => MediaType, { nullable: true })
  @ApiProperty({
    enum: MediaType,
    required: false,
    description: 'The media type of the attachment',
  })
  @IsOptional()
  mediaType?: MediaType;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'MIME type. Auto-detected from file if not provided.',
  })
  @IsOptional()
  @IsString()
  mime?: string;
}
