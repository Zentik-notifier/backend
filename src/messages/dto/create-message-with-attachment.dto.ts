import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MediaType } from '../../notifications/notifications.types';
import { CreateMessageDto } from './create-message.dto';

@InputType('AttachmentOptionsInput')
export class AttachmentOptionsDto {
  @Field(() => MediaType, { description: 'Type of media being uploaded' })
  @ApiProperty({
    enum: MediaType,
    enumName: 'MediaType',
    description: 'Type of media being uploaded',
  })
  @IsEnum(MediaType)
  mediaType: MediaType;

  @Field({ nullable: true, description: 'Custom name for the attachment' })
  @ApiProperty({
    required: false,
    description: 'Custom name for the attachment',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

@InputType('CreateMessageWithAttachmentInput')
export class CreateMessageWithAttachmentDto extends CreateMessageDto {
  @Field(() => AttachmentOptionsDto, {
    description: 'Options for the uploaded attachment',
  })
  @ApiProperty({
    type: AttachmentOptionsDto,
    description: 'Options for the uploaded attachment',
  })
  @Transform(
    ({ value }) => {
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (_) {
          return value;
        }
      }
      if (value && typeof value === 'object') {
        return plainToInstance(AttachmentOptionsDto, value);
      }
      return value;
    },
    { toClassOnly: true },
  )
  @ValidateNested()
  @Type(() => AttachmentOptionsDto)
  attachmentOptions: AttachmentOptionsDto;
}
