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
import { Log } from './src/entities/log.entity';
import { SystemAccessToken } from './src/system-access-token/system-access-token.entity';
import { AdminSubscription } from './src/entities/admin-subscription.entity';
import { UpdateEnumsToUppercaseAndAddInviteCodes1729458000000 } from './database/migrations/1729458000000-UpdateEnumsToUppercaseAndAddInviteCodes';
import { AddBucketCreationEvent1729520000000 } from './database/migrations/1729520000000-AddBucketCreationEvent';
import { IncreaseLogMessageLength1729522000000 } from 'database/migrations/1729522000000-IncreaseLogMessageLength';
import { AddExecutionIdToMessages1737561600000 } from 'database/migrations/1737561600000-AddExecutionIdToMessages';
import { CreateSystemAccessTokenRequests1738100000000 } from './database/migrations/1738100000000-CreateSystemAccessTokenRequests';
import { AddScopesToSystemAccessTokens1738101000000 } from './database/migrations/1738101000000-AddScopesToSystemAccessTokens';
import { AddServerStableIdentifierToServerSettingsEnum1738104000000 } from './database/migrations/1738104000000-AddServerStableIdentifierToServerSettingsEnum';
import { AddPlainTextTokenToSystemAccessTokens1738200000000 } from './database/migrations/1738200000000-AddPlainTextTokenToSystemAccessTokens';
import { AddExchangeCodeToUserSessions1730220000000 } from './database/migrations/1730220000000-AddExchangeCodeToUserSessions';

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
    Log,
    AdminSubscription,
    MessageReminder,
  ],
  migrations: [
    UpdateEnumsToUppercaseAndAddInviteCodes1729458000000,
    AddBucketCreationEvent1729520000000,
    IncreaseLogMessageLength1729522000000,
    AddExecutionIdToMessages1737561600000,
    CreateSystemAccessTokenRequests1738100000000,
    AddScopesToSystemAccessTokens1738101000000,
    AddServerStableIdentifierToServerSettingsEnum1738104000000,
    AddPlainTextTokenToSystemAccessTokens1738200000000,
    AddExchangeCodeToUserSessions1730220000000,
  ],
  migrationsTableName: 'migrations',
});

export default dataSource;

