import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsUUID } from 'class-validator';

@InputType()
export class PostponeNotificationDto {
  @Field()
  @ApiProperty({
    description: 'Notification ID to postpone',
    example: 'abc-123-notification-uuid',
  })
  @IsUUID()
  notificationId: string;

  @Field(() => Int)
  @ApiProperty({
    description: 'Minutes to postpone the notification',
    example: 30,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  minutes: number;
}

@ObjectType()
export class PostponeResponseDto {
  @Field()
  @ApiProperty()
  id: string;

  @Field()
  @ApiProperty()
  notificationId: string;

  @Field()
  @ApiProperty()
  sendAt: Date;

  @Field()
  @ApiProperty()
  createdAt: Date;
}
