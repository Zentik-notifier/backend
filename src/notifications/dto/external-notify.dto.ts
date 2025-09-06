import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ExternalNotifyRequestDto {
  @ApiProperty({ type: String, description: 'Stringified Notification JSON' })
  @IsString()
  notification!: string;

  @ApiProperty({ type: String, description: 'Stringified UserDevice JSON' })
  @IsString()
  userDevice!: string;
}
