import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import {
  Attachment,
  Bucket,
  EntityExecution,
  EntityPermission,
  Event,
  InviteCode,
  Message,
  Notification,
  NotificationPostpone,
  OAuthProvider,
  PayloadMapper,
  User,
  UserAccessToken,
  UserBucket,
  UserDevice,
  UserIdentity,
  UserSession,
  UserWebhook,
  UserSetting,
  MessageReminder,
  UserLog,
  UserTemplate,
} from './src/entities';
import { Changelog } from './src/entities/changelog.entity';
import { ServerSetting } from './src/entities/server-setting.entity';
import { SystemAccessToken } from './src/system-access-token/system-access-token.entity';
import { AdminSubscription } from './src/entities/admin-subscription.entity';
import { InitialSchema1762016264000 } from './database/migrations/1762016264000-InitialSchema';
import { AddMagicCodeToUserBuckets1762032600961 } from './database/migrations/1762032600961-AddMagicCodeToUserBuckets';
import { AddIconAndRegistrationSettings1762036000000 } from './database/migrations/1762036000000-AddIconAndRegistrationSettings';
import { AddSocialLoginEnabledSetting1762037000000 } from './database/migrations/1762037000000-AddSocialLoginEnabledSetting';
import { AddIconUrlToBuckets1762423000000 } from './database/migrations/1762423000000-AddIconUrlToBuckets';
import { AddLogStorageDirectorySetting1762438000000 } from './database/migrations/1762438000000-AddLogStorageDirectorySetting';
import { MakePasswordNullable1731839520000 } from './database/migrations/1731839520000-MakePasswordNullable';
import { AddNoPushDeliveryType1731847000000 } from './database/migrations/1731847000000-AddNoPushDeliveryType';
import { AddAdditionalInfoToEventsAndNotificationExecution1732021200000 } from './database/migrations/1732021200000-AddAdditionalInfoToEventsAndNotificationExecution';
import { AddCustomNameToUserBucket1732050933000 } from './database/migrations/1732050933000-AddCustomNameToUserBucket';
import { AddUniqueConstraintNotificationAck1732716000000 } from './database/migrations/1732716000000-AddUniqueConstraintNotificationAck';
import { AddUserLogsAndFeedbackEvent1763200000000 } from './database/migrations/1763200000000-AddUserLogsAndFeedbackEvent';
import { CreateUserTemplatesTable1765194473000 } from './database/migrations/1765194473000-CreateUserTemplatesTable';
import { AddMetadataToUserDevices1766000000000 } from './database/migrations/1766000000000-AddMetadataToUserDevices';
import { CreateChangelogTable1767000000000 } from './database/migrations/1767000000000-CreateChangelogTable';
import { AddChangelogRemoteServerSetting1768000000000 } from './database/migrations/1768000000000-AddChangelogRemoteServerSetting';

config({ path: '.env' });

const dbType = (process.env.DB_TYPE as any) || 'postgres';

const dataSource = new DataSource({
  type: dbType,
  ...(dbType === 'sqlite'
    ? {
        database: process.env.DB_DATABASE || ':memory:',
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'zentik_user',
        password: process.env.DB_PASSWORD || 'zentik_password',
        database: process.env.DB_NAME || 'zentik',
        ssl:
          process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }),
  entities: [
    SystemAccessToken,
    PayloadMapper,
    Attachment,
    EntityExecution,
    Event,
    InviteCode,
    Message,
    User,
    UserBucket,
    UserAccessToken,
    UserDevice,
    UserSession,
    UserWebhook,
    UserIdentity,
    Bucket,
    EntityPermission,
    Notification,
    NotificationPostpone,
    OAuthProvider,
    UserSetting,
    ServerSetting,
    AdminSubscription,
    MessageReminder,
    UserLog,
    UserTemplate,
    Changelog,
  ],
  migrations: [
    InitialSchema1762016264000,
    AddMagicCodeToUserBuckets1762032600961,
    AddIconAndRegistrationSettings1762036000000,
    AddSocialLoginEnabledSetting1762037000000,
    AddIconUrlToBuckets1762423000000,
    AddLogStorageDirectorySetting1762438000000,
    MakePasswordNullable1731839520000,
    AddNoPushDeliveryType1731847000000,
    AddAdditionalInfoToEventsAndNotificationExecution1732021200000,
    AddCustomNameToUserBucket1732050933000,
    AddUniqueConstraintNotificationAck1732716000000,
    AddUserLogsAndFeedbackEvent1763200000000,
    CreateUserTemplatesTable1765194473000,
    AddMetadataToUserDevices1766000000000,
    CreateChangelogTable1767000000000,
    AddChangelogRemoteServerSetting1768000000000,
  ],
  migrationsTableName: 'migrations',
});

export default dataSource;

