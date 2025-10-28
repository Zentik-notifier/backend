import { registerEnumType } from '@nestjs/graphql';

export enum UserSettingType {
  Timezone = 'Timezone',
  Language = 'Language',
  UnencryptOnBigPayload = 'UnencryptOnBigPayload',
  ExpoKey = 'ExpoKey',
  HomeassistantUrl = 'HomeassistantUrl',
  HomeassistantToken = 'HomeassistantToken',
  // Auto-add notification actions settings
  AutoAddDeleteAction = 'AutoAddDeleteAction',
  AutoAddMarkAsReadAction = 'AutoAddMarkAsReadAction',
  AutoAddOpenNotificationAction = 'AutoAddOpenNotificationAction',
  DefaultPostpones = 'DefaultPostpones',
  DefaultSnoozes = 'DefaultSnoozes',
  // GitHub property mapper settings
  GithubEventsFilter = 'GithubEventsFilter',
  // Self-hosted stable server identifier
  ServerStableIdentifier = 'ServerStableIdentifier',
}

registerEnumType(UserSettingType, { name: 'UserSettingType' });

