import { Field, ObjectType } from '@nestjs/graphql';
import { DevicePlatform } from '../../users/dto';
import { NotificationServiceType } from '../notifications.types';

@ObjectType()
export class NotificationServiceInfo {
  @Field(() => DevicePlatform)
  devicePlatform: DevicePlatform;

  @Field(() => NotificationServiceType)
  service: NotificationServiceType;
}
