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
} from './src/entities';
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
  ],
  migrationsTableName: 'migrations',
});

export default dataSource;

