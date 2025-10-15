import { registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationDeliveryType {
  SILENT = 'SILENT',
  NORMAL = 'NORMAL',
  CRITICAL = 'CRITICAL',
}

export enum NotificationActionType {
  NAVIGATE = 'NAVIGATE',
  BACKGROUND_CALL = 'BACKGROUND_CALL',
  MARK_AS_READ = 'MARK_AS_READ',
  SNOOZE = 'SNOOZE',
  POSTPONE = 'POSTPONE',
  OPEN_NOTIFICATION = 'OPEN_NOTIFICATION',
  WEBHOOK = 'WEBHOOK',
  DELETE = 'DELETE',
}

export enum MediaType {
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  GIF = 'GIF',
  AUDIO = 'AUDIO',
  ICON = 'ICON',
}

export enum NotificationServiceType {
  PUSH = 'PUSH',
  LOCAL = 'LOCAL',
}

export enum NotificationServiceProvider {
  FIREBASE = 'FIREBASE',
  IOS = 'IOS',
  WEB_PUSH = 'WEB_PUSH',
}

// GraphQL registrations
registerEnumType(NotificationDeliveryType, {
  name: 'NotificationDeliveryType',
  description: 'Delivery type for notifications',
});

registerEnumType(NotificationActionType, {
  name: 'NotificationActionType',
  description:
    'Type of notification action including BACKGROUND_CALL for external integrations and WEBHOOK for internal actions',
});

registerEnumType(MediaType, {
  name: 'MediaType',
  description: 'Type of media attachment',
});

registerEnumType(NotificationServiceType, {
  name: 'NotificationServiceType',
  description: 'Type of notification service (Push or Local)',
});

registerEnumType(NotificationServiceProvider, {
  name: 'NotificationServiceProvider',
  description: 'Provider of the notification service',
});

// Schema definitions for OpenAPI enum generation
export class NotificationDeliveryTypeSchema {
  @ApiProperty({
    enum: NotificationDeliveryType,
    enumName: 'NotificationDeliveryType',
    description: 'Delivery type for notifications',
  })
  deliveryType: NotificationDeliveryType;
}

export class NotificationActionTypeSchema {
  @ApiProperty({
    enum: NotificationActionType,
    enumName: 'NotificationActionType',
    description:
      'Type of notification action including BACKGROUND_CALL for external integrations and WEBHOOK for internal actions',
  })
  type: NotificationActionType;
}

export class NotificationServiceTypeSchema {
  @ApiProperty({
    enum: NotificationServiceType,
    enumName: 'NotificationServiceType',
    description: 'Type of notification service (Push or Local)',
  })
  type: NotificationServiceType;
}

export class NotificationServiceProviderSchema {
  @ApiProperty({
    enum: NotificationServiceProvider,
    enumName: 'NotificationServiceProvider',
    description: 'Provider of the notification service',
  })
  provider: NotificationServiceProvider;
}
