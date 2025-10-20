import { TypeOrmModuleOptions } from '@nestjs/typeorm';
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
} from '../entities';
import { ServerSetting } from '../entities/server-setting.entity';
import { Log } from '../entities/log.entity';
import { SystemAccessToken } from '../system-access-token/system-access-token.entity';
import { AdminSubscription } from '../entities/admin-subscription.entity';

config({ path: '.env' });

const dbType = (process.env.DB_TYPE as any) || 'postgres';

export const databaseConfig: TypeOrmModuleOptions = {
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
      retryAttempts: 20
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
  // NOTE: Migrations are run automatically during app bootstrap (see main.ts)
  // For manual migration management, use: npm run migration:run/revert/show
  // synchronize should be FALSE in production - use migrations instead
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  dropSchema: process.env.DB_DROP_SCHEMA === 'true',
  logging:
    process.env.DB_LOGGING === 'true' || process.env.LOG_LEVEL === 'debug',
};
