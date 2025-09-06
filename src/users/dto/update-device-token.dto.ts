import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class UpdateDeviceTokenDto {
  @Field()
  @ApiProperty({ description: 'Old device token to identify the device' })
  @IsString()
  @IsNotEmpty()
  oldDeviceToken: string;

  @Field()
  @ApiProperty({ description: 'New device token to replace the old one' })
  @IsString()
  @IsNotEmpty()
  newDeviceToken: string;
}
