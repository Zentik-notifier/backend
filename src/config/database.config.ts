import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';
import {
  Attachment,
  Bucket,
  EntityPermission,
  Event,
  Message,
  Notification,
  OAuthProvider,
  User,
  UserAccessToken,
  UserBucket,
  UserDevice,
  UserIdentity,
  UserSession,
  UserWebhook,
} from '../entities';
import { SystemAccessToken } from '../system-access-token/system-access-token.entity';

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
      }),
  entities: [
    SystemAccessToken,
    Attachment,
    Event,
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
    OAuthProvider,
  ],
  // migrations: [__sdirname + '/../database/migrations/*.ts'],
  synchronize:
    process.env.DB_SYNCHRONIZE === 'true',
  dropSchema: process.env.DB_DROP_SCHEMA === 'true',
  logging:
    process.env.DB_LOGGING === 'true' || process.env.LOG_LEVEL === 'debug',
};
