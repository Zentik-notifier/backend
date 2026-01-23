import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class BatchDeleteWatchDto {
  @ApiProperty({
    description: 'Array of notification IDs to delete',
    example: ['abc-123-notification-uuid', 'def-456-notification-uuid'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}

export class BatchMarkReadWatchDto {
  @ApiProperty({
    description: 'Array of notification IDs to mark as read',
    example: ['abc-123-notification-uuid', 'def-456-notification-uuid'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}

export class BatchMarkUnreadWatchDto {
  @ApiProperty({
    description: 'Array of notification IDs to mark as unread',
    example: ['abc-123-notification-uuid', 'def-456-notification-uuid'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}

export class BatchDeleteWatchResponseDto {
  @ApiProperty({
    description: 'Number of notifications deleted',
    example: 2,
  })
  deletedCount: number;

  @ApiProperty({
    description: 'Array of deleted notification IDs',
    example: ['abc-123-notification-uuid', 'def-456-notification-uuid'],
    type: [String],
  })
  deletedIds: string[];
}

export class BatchMarkWatchResponseDto {
  @ApiProperty({
    description: 'Number of notifications updated',
    example: 2,
  })
  updatedCount: number;

  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;
}
