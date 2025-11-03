import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

/**
 * Initial database schema migration
 * 
 * This migration creates the complete database schema manually based on schema_init.sql.
 * It only runs if the database is completely empty (no tables exist).
 * 
 * For existing databases, this migration is safely skipped.
 */
export class InitialSchema1762016264000 implements MigrationInterface {
  name = 'InitialSchema1762016264000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if database already has tables (indicates an existing installation)
    const tables = await queryRunner.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != 'migrations'
        AND table_name != 'typeorm_metadata';
    `);

    if (tables.length > 0) {
      console.log('✅ Database already initialized, skipping schema creation');
      return;
    }

    console.log('🗄️  Initializing empty database with full schema...');

    // Step 1: Create extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;`);

    // Step 2: Create ENUM types
    await this.createEnumTypes(queryRunner);

    // Step 3: Create trigger function
    await queryRunner.query(`
      CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
      LANGUAGE plpgsql
      AS $$
        BEGIN
            NEW."updatedAt" = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
      $$;
    `);

    // Step 4: Create migrations sequence
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'S'
            AND c.relname = 'migrations_id_seq'
            AND n.nspname = 'public'
        ) THEN
          CREATE SEQUENCE public.migrations_id_seq
          AS integer
          START WITH 1
          INCREMENT BY 1
          NO MINVALUE
          NO MAXVALUE
          CACHE 1;
        END IF;
      END$$;
    `);

    // Step 5: Create all tables (in dependency order)
    await this.createTables(queryRunner);

    // Step 6: Create primary keys and unique constraints
    await this.createConstraints(queryRunner);

    // Step 7: Create indexes
    await this.createIndexes(queryRunner);

    // Step 8: Create foreign keys
    await this.createForeignKeys(queryRunner);

    // Step 9: Create triggers
    await this.createTriggers(queryRunner);

    console.log('✅ Database schema initialized successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️  Cannot safely revert initial schema migration');
  }

  private async createEnumTypes(queryRunner: QueryRunner): Promise<void> {
    const enums = [
      { name: 'UserSettingType', values: ['Timezone', 'Language', 'UnencryptOnBigPayload', 'ExpoKey', 'HomeassistantUrl', 'HomeassistantToken', 'AutoAddDeleteAction', 'AutoAddMarkAsReadAction', 'AutoAddOpenNotificationAction', 'DefaultPostpones', 'DefaultSnoozes', 'GithubEventsFilter'] },
      { name: 'attachments_mediatype_enum', values: ['VIDEO', 'IMAGE', 'GIF', 'AUDIO', 'ICON'] },
      { name: 'device_platform_enum', values: ['IOS', 'ANDROID', 'WEB'] },
      { name: 'entity_executions_status_enum', values: ['SUCCESS', 'ERROR', 'TIMEOUT', 'SKIPPED'] },
      { name: 'entity_executions_type_enum', values: ['WEBHOOK', 'PAYLOAD_MAPPER'] },
      { name: 'events_type_enum', values: ['LOGIN', 'LOGIN_OAUTH', 'LOGOUT', 'REGISTER', 'PUSH_PASSTHROUGH', 'MESSAGE', 'NOTIFICATION', 'NOTIFICATION_ACK', 'BUCKET_SHARING', 'BUCKET_UNSHARING', 'DEVICE_REGISTER', 'DEVICE_UNREGISTER', 'ACCOUNT_DELETE', 'BUCKET_CREATION', 'SYSTEM_TOKEN_REQUEST_CREATED', 'SYSTEM_TOKEN_REQUEST_APPROVED', 'SYSTEM_TOKEN_REQUEST_DECLINED'] },
      { name: 'log_level_enum', values: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] },
      { name: 'messages_deliverytype_enum', values: ['SILENT', 'NORMAL', 'CRITICAL'] },
      { name: 'oauth_provider_type_enum', values: ['GITHUB', 'GOOGLE', 'DISCORD', 'APPLE', 'APPLE_SIGNIN', 'CUSTOM', 'FACEBOOK', 'MICROSOFT'] },
      { name: 'payload_mappers_builtinname_enum', values: ['ZENTIK_AUTHENTIK', 'ZENTIK_SERVARR', 'ZENTIK_RAILWAY', 'ZENTIK_GITHUB', 'ZENTIK_EXPO', 'ZENTIK_STATUS_IO', 'ZENTIK_INSTATUS'] },
      { name: 'server_setting_type_enum', values: ['JwtAccessTokenExpiration', 'JwtRefreshTokenExpiration', 'ApnPush', 'ApnKeyId', 'ApnTeamId', 'ApnPrivateKeyPath', 'ApnBundleId', 'ApnProduction', 'FirebasePush', 'FirebaseProjectId', 'FirebasePrivateKey', 'FirebaseClientEmail', 'WebPush', 'VapidSubject', 'PushNotificationsPassthroughServer', 'PushPassthroughToken', 'AttachmentsEnabled', 'AttachmentsStoragePath', 'AttachmentsMaxFileSize', 'AttachmentsAllowedMimeTypes', 'AttachmentsDeleteJobEnabled', 'AttachmentsMaxAge', 'BackupEnabled', 'BackupExecuteOnStart', 'BackupStoragePath', 'BackupMaxToKeep', 'BackupCronJob', 'MessagesMaxAge', 'MessagesDeleteJobEnabled', 'EmailEnabled', 'EmailType', 'EmailHost', 'EmailPort', 'EmailSecure', 'EmailUser', 'EmailPass', 'EmailFrom', 'EmailFromName', 'ResendApiKey', 'RateLimitTrustProxyEnabled', 'RateLimitForwardHeader', 'RateLimitTtlMs', 'RateLimitLimit', 'RateLimitBlockMs', 'RateLimitMessagesRps', 'RateLimitMessagesTtlMs', 'JwtSecret', 'JwtRefreshSecret', 'CorsOrigin', 'CorsCredentials', 'LogLevel', 'LogStorageEnabled', 'LogRetentionDays', 'PrometheusEnabled', 'ServerStableIdentifier', 'EnableSystemTokenRequests', 'SystemTokenUsageStats', 'ServerFilesDirectory'] },
      { name: 'system_access_token_request_status', values: ['pending', 'approved', 'declined'] },
      { name: 'user_setting_type_enum', values: ['Timezone', 'Language', 'UnencryptOnBigPayload', 'ExpoKey', 'HomeassistantUrl', 'HomeassistantToken', 'AutoAddDeleteAction', 'AutoAddMarkAsReadAction', 'AutoAddOpenNotificationAction', 'DefaultPostpones', 'DefaultSnoozes', 'GithubEventsFilter', 'ServerStableIdentifier', 'AppleAuthResponse', 'GoogleAuthResponse'] },
      { name: 'user_webhooks_method_enum', values: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { name: 'users_role_enum', values: ['user', 'moderator', 'admin'] },
    ];

    for (const enumDef of enums) {
      const values = enumDef.values
        .map(v => "''" + v.replace(/'/g, "''") + "''")
        .join(', ');

      const doBlock = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = '${enumDef.name}' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE TYPE public."${enumDef.name}" AS ENUM (${values})';
  END IF;
END$$;`;
      await queryRunner.query(doBlock);
    }
  }

  private async createTables(queryRunner: QueryRunner): Promise<void> {
    // Create tables in dependency order
    const tables = this.getTableDefinitions();
    
    for (const tableDef of tables) {
      await queryRunner.createTable(tableDef.table, true);
      console.log(`  ✅ Created table: ${tableDef.table.name}`);
    }
  }

  private getTableDefinitions(): Array<{ table: Table }> {
    return [
      // users (base table)
      {
        table: new Table({
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'email', type: 'varchar', isUnique: true },
            { name: 'username', type: 'varchar', isUnique: true },
            { name: 'password', type: 'varchar' },
            { name: 'hasPassword', type: 'boolean', default: true },
            { name: 'firstName', type: 'varchar', isNullable: true },
            { name: 'lastName', type: 'varchar', isNullable: true },
            { name: 'avatar', type: 'varchar', isNullable: true },
            { name: 'role', type: 'enum', enumName: 'users_role_enum', default: "'user'" },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'resetToken', type: 'text', isNullable: true },
            { name: 'resetTokenRequestedAt', type: 'timestamp', isNullable: true },
            { name: 'emailConfirmationToken', type: 'text', isNullable: true },
            { name: 'emailConfirmationTokenRequestedAt', type: 'timestamp', isNullable: true },
            { name: 'emailConfirmed', type: 'boolean', default: false },
          ],
        }),
      },
      // buckets
      {
        table: new Table({
          name: 'buckets',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'name', type: 'varchar' },
            { name: 'icon', type: 'varchar', isNullable: true },
            { name: 'description', type: 'varchar', isNullable: true },
            { name: 'color', type: 'varchar', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'userId', type: 'uuid', isNullable: true },
            { name: 'isProtected', type: 'boolean', default: false },
            { name: 'isPublic', type: 'boolean', default: false },
            { name: 'isAdmin', type: 'boolean', default: false },
            { name: 'iconAttachmentUuid', type: 'varchar', isNullable: true },
          ],
        }),
      },
      // messages
      {
        table: new Table({
          name: 'messages',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'title', type: 'varchar' },
            { name: 'subtitle', type: 'varchar', isNullable: true },
            { name: 'body', type: 'varchar', isNullable: true },
            { name: 'attachments', type: 'json', isNullable: true },
            { name: 'attachmentUuids', type: 'text', isArray: true, isNullable: true },
            { name: 'actions', type: 'json', isNullable: true },
            { name: 'tapAction', type: 'json', isNullable: true },
            { name: 'sound', type: 'varchar', isNullable: true },
            { name: 'deliveryType', type: 'enum', enumName: 'messages_deliverytype_enum', default: "'NORMAL'" },
            { name: 'addMarkAsReadAction', type: 'boolean', isNullable: true },
            { name: 'addOpenNotificationAction', type: 'boolean', isNullable: true },
            { name: 'addDeleteAction', type: 'boolean', isNullable: true },
            { name: 'snoozes', type: 'integer', isArray: true, isNullable: true },
            { name: 'locale', type: 'varchar', isNullable: true },
            { name: 'bucketId', type: 'uuid' },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'groupId', type: 'varchar', isNullable: true },
            { name: 'collapseId', type: 'varchar', isNullable: true },
            { name: 'postpones', type: 'integer', isArray: true, isNullable: true },
            { name: 'remindEveryMinutes', type: 'integer', isNullable: true },
            { name: 'maxReminders', type: 'integer', default: 5, isNullable: true },
            { name: 'executionId', type: 'varchar', isNullable: true },
          ],
        }),
      },
      // user_devices
      {
        table: new Table({
          name: 'user_devices',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'userId', type: 'uuid' },
            { name: 'deviceToken', type: 'varchar', length: '255', isNullable: true },
            { name: 'platform', type: 'enum', enumName: 'device_platform_enum' },
            { name: 'deviceName', type: 'varchar', isNullable: true },
            { name: 'deviceModel', type: 'varchar', isNullable: true },
            { name: 'osVersion', type: 'varchar', isNullable: true },
            { name: 'publicKey', type: 'text', isNullable: true },
            { name: 'privateKey', type: 'text', isNullable: true },
            { name: 'subscriptionFields', type: 'jsonb', isNullable: true },
            { name: 'onlyLocal', type: 'boolean', default: false },
            { name: 'lastUsed', type: 'timestamp' },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
      // invite_codes
      {
        table: new Table({
          name: 'invite_codes',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
            { name: 'code', type: 'varchar', length: '255', isUnique: true },
            { name: 'resourceType', type: 'varchar', length: '50' },
            { name: 'resourceId', type: 'uuid' },
            { name: 'createdBy', type: 'uuid' },
            { name: 'permissions', type: 'text' },
            { name: 'expiresAt', type: 'timestamptz', isNullable: true },
            { name: 'usageCount', type: 'integer', default: 0 },
            { name: 'maxUses', type: 'integer', isNullable: true },
            { name: 'createdAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      },
      // system_access_tokens
      {
        table: new Table({
          name: 'system_access_tokens',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'tokenHash', type: 'varchar' },
            { name: 'maxCalls', type: 'integer', default: 0 },
            { name: 'calls', type: 'integer', default: 0 },
            { name: 'expiresAt', type: 'timestamp', isNullable: true },
            { name: 'requesterId', type: 'uuid', isNullable: true },
            { name: 'description', type: 'text', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'scopes', type: 'text', isArray: true, default: "'{}'" },
            { name: 'requesterIdentifier', type: 'text', isNullable: true },
            { name: 'token', type: 'text', isNullable: true },
            { name: 'totalCalls', type: 'integer', default: 0 },
            { name: 'lastResetAt', type: 'timestamptz', isNullable: true },
          ],
        }),
      },
      // system_access_token_requests
      {
        table: new Table({
          name: 'system_access_token_requests',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
            { name: 'userId', type: 'uuid' },
            { name: 'systemAccessTokenId', type: 'uuid', isNullable: true },
            { name: 'plainTextToken', type: 'text', isNullable: true },
            { name: 'maxRequests', type: 'integer' },
            { name: 'status', type: 'enum', enumName: 'system_access_token_request_status', default: "'pending'" },
            { name: 'description', type: 'text', isNullable: true },
            { name: 'createdAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      },
      // notifications
      {
        table: new Table({
          name: 'notifications',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'receivedAt', type: 'timestamp', isNullable: true },
            { name: 'readAt', type: 'timestamp', isNullable: true },
            { name: 'error', type: 'varchar', isNullable: true },
            { name: 'sentAt', type: 'timestamp', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'userId', type: 'uuid' },
            { name: 'userDeviceId', type: 'uuid', isNullable: true },
            { name: 'messageId', type: 'uuid', isNullable: true },
          ],
        }),
      },
      // attachments
      {
        table: new Table({
          name: 'attachments',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'filename', type: 'varchar' },
            { name: 'filepath', type: 'varchar' },
            { name: 'mediaType', type: 'enum', enumName: 'attachments_mediatype_enum', isNullable: true },
            { name: 'messageId', type: 'varchar', isNullable: true },
            { name: 'userId', type: 'uuid' },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'originalFilename', type: 'varchar', isNullable: true },
            { name: 'size', type: 'bigint', isNullable: true },
          ],
        }),
      },
      // entity_executions
      {
        table: new Table({
          name: 'entity_executions',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'type', type: 'enum', enumName: 'entity_executions_type_enum' },
            { name: 'status', type: 'enum', enumName: 'entity_executions_status_enum' },
            { name: 'entityName', type: 'varchar', isNullable: true },
            { name: 'entityId', type: 'varchar', isNullable: true },
            { name: 'userId', type: 'uuid' },
            { name: 'input', type: 'text' },
            { name: 'output', type: 'text', isNullable: true },
            { name: 'errors', type: 'text', isNullable: true },
            { name: 'durationMs', type: 'bigint', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
      // entity_permissions
      {
        table: new Table({
          name: 'entity_permissions',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'resourceType', type: 'varchar' },
            { name: 'resourceId', type: 'uuid' },
            { name: 'permissions', type: 'text' },
            { name: 'expiresAt', type: 'timestamp', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'userId', type: 'uuid', isNullable: true },
            { name: 'grantedById', type: 'uuid', isNullable: true },
            { name: 'inviteCodeId', type: 'uuid', isNullable: true },
          ],
        }),
      },
      // events
      {
        table: new Table({
          name: 'events',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'type', type: 'enum', enumName: 'events_type_enum' },
            { name: 'userId', type: 'varchar', isNullable: true },
            { name: 'objectId', type: 'varchar', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'targetId', type: 'varchar', isNullable: true },
          ],
        }),
      },
      // logs
      {
        table: new Table({
          name: 'logs',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'level', type: 'enum', enumName: 'log_level_enum' },
            { name: 'message', type: 'text' },
            { name: 'context', type: 'text', isNullable: true },
            { name: 'trace', type: 'text', isNullable: true },
            { name: 'metadata', type: 'jsonb', isNullable: true },
            { name: 'timestamp', type: 'timestamptz', default: 'now()' },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
      // message_reminders
      {
        table: new Table({
          name: 'message_reminders',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'messageId', type: 'uuid' },
            { name: 'userId', type: 'uuid' },
            { name: 'remindEveryMinutes', type: 'integer' },
            { name: 'maxReminders', type: 'integer', default: 5 },
            { name: 'remindersSent', type: 'integer', default: 0 },
            { name: 'nextReminderAt', type: 'timestamptz' },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
      // migrations (TypeORM table)
      {
        table: new Table({
          name: 'migrations',
          columns: [
            { name: 'id', type: 'integer', isPrimary: true, default: "nextval('migrations_id_seq')" },
            { name: 'timestamp', type: 'bigint' },
            { name: 'name', type: 'varchar' },
          ],
        }),
      },
      // notification_postpones
      {
        table: new Table({
          name: 'notification_postpones',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'notificationId', type: 'uuid' },
            { name: 'messageId', type: 'uuid' },
            { name: 'userId', type: 'uuid' },
            { name: 'sendAt', type: 'timestamp' },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
      // oauth_providers
      {
        table: new Table({
          name: 'oauth_providers',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'name', type: 'varchar' },
            { name: 'type', type: 'varchar' },
            { name: 'clientId', type: 'varchar' },
            { name: 'clientSecret', type: 'varchar' },
            { name: 'callbackUrl', type: 'varchar', isNullable: true },
            { name: 'scopes', type: 'text' },
            { name: 'isEnabled', type: 'boolean', default: true },
            { name: 'iconUrl', type: 'varchar', isNullable: true },
            { name: 'color', type: 'varchar', isNullable: true },
            { name: 'textColor', type: 'varchar', isNullable: true },
            { name: 'authorizationUrl', type: 'varchar', isNullable: true },
            { name: 'tokenUrl', type: 'varchar', isNullable: true },
            { name: 'userInfoUrl', type: 'varchar', isNullable: true },
            { name: 'profileFields', type: 'text', isNullable: true },
            { name: 'additionalConfig', type: 'text', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
      // payload_mappers
      {
        table: new Table({
          name: 'payload_mappers',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'userId', type: 'uuid', isNullable: true },
            { name: 'name', type: 'varchar' },
            { name: 'builtInName', type: 'enum', enumName: 'payload_mappers_builtinname_enum', isNullable: true },
            { name: 'jsEvalFn', type: 'text' },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'requiredUserSettings', type: 'enum', enumName: 'UserSettingType', isArray: true, isNullable: true },
          ],
        }),
      },
      // server_settings
      {
        table: new Table({
          name: 'server_settings',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'configType', type: 'enum', enumName: 'server_setting_type_enum', isUnique: true },
            { name: 'valueText', type: 'text', isNullable: true },
            { name: 'valueBool', type: 'boolean', isNullable: true },
            { name: 'valueNumber', type: 'integer', isNullable: true },
            { name: 'possibleValues', type: 'text', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
      // typeorm_metadata (TypeORM internal)
      {
        table: new Table({
          name: 'typeorm_metadata',
          columns: [
            { name: 'type', type: 'varchar' },
            { name: 'database', type: 'varchar', isNullable: true },
            { name: 'schema', type: 'varchar', isNullable: true },
            { name: 'table', type: 'varchar', isNullable: true },
            { name: 'name', type: 'varchar', isNullable: true },
            { name: 'value', type: 'text', isNullable: true },
          ],
        }),
      },
      // user_access_tokens
      {
        table: new Table({
          name: 'user_access_tokens',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'name', type: 'varchar' },
            { name: 'tokenHash', type: 'varchar', isUnique: true },
            { name: 'expiresAt', type: 'timestamp', isNullable: true },
            { name: 'scopes', type: 'text', isNullable: true },
            { name: 'lastUsed', type: 'timestamp', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'userId', type: 'uuid' },
            { name: 'token', type: 'text', isNullable: true },
          ],
        }),
      },
      // user_buckets
      {
        table: new Table({
          name: 'user_buckets',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'userId', type: 'uuid' },
            { name: 'bucketId', type: 'uuid' },
            { name: 'snoozeUntil', type: 'timestamptz', isNullable: true },
            { name: 'snoozes', type: 'jsonb', default: "'[]'" },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
      // user_identities
      {
        table: new Table({
          name: 'user_identities',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'email', type: 'text', isNullable: true },
            { name: 'avatarUrl', type: 'text', isNullable: true },
            { name: 'userId', type: 'uuid' },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'metadata', type: 'text', isNullable: true },
            { name: 'providerType', type: 'enum', enumName: 'oauth_provider_type_enum', isNullable: true },
          ],
        }),
      },
      // user_sessions
      {
        table: new Table({
          name: 'user_sessions',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'userId', type: 'uuid' },
            { name: 'tokenId', type: 'varchar', length: '255' },
            { name: 'deviceName', type: 'varchar', length: '255', isNullable: true },
            { name: 'operatingSystem', type: 'varchar', length: '255', isNullable: true },
            { name: 'browser', type: 'varchar', length: '100', isNullable: true },
            { name: 'ipAddress', type: 'varchar', length: '45', isNullable: true },
            { name: 'userAgent', type: 'varchar', length: '500', isNullable: true },
            { name: 'loginProvider', type: 'varchar', length: '50', isNullable: true },
            { name: 'lastActivity', type: 'timestamp', isNullable: true },
            { name: 'expiresAt', type: 'timestamp' },
            { name: 'isActive', type: 'boolean', default: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'exchangeCode', type: 'text', isNullable: true },
            { name: 'exchangeCodeRequestedAt', type: 'timestamp', isNullable: true },
          ],
        }),
      },
      // user_settings
      {
        table: new Table({
          name: 'user_settings',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'userId', type: 'uuid' },
            { name: 'deviceId', type: 'uuid', isNullable: true },
            { name: 'configType', type: 'enum', enumName: 'user_setting_type_enum' },
            { name: 'valueText', type: 'text', isNullable: true },
            { name: 'valueBool', type: 'boolean', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
      // user_webhooks
      {
        table: new Table({
          name: 'user_webhooks',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'name', type: 'varchar' },
            { name: 'method', type: 'enum', enumName: 'user_webhooks_method_enum' },
            { name: 'url', type: 'text' },
            { name: 'headers', type: 'jsonb', default: "'[]'" },
            { name: 'body', type: 'jsonb', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            { name: 'userId', type: 'uuid', isNullable: true },
          ],
        }),
      },
      // admin_subscriptions
      {
        table: new Table({
          name: 'admin_subscriptions',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'userId', type: 'uuid' },
            { name: 'eventTypes', type: 'text', isArray: true, default: "'{}'" },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
      },
    ];
  }

  private async createConstraints(queryRunner: QueryRunner): Promise<void> {
    // Create unique constraints
    await queryRunner.createUniqueConstraint('entity_permissions', new TableUnique({ 
      columnNames: ['resourceType', 'resourceId', 'userId'], 
      name: 'UQ_2d277076aeb8cf3acc0e6b1411e'
    }));
    await queryRunner.createUniqueConstraint('user_identities', new TableUnique({ 
      columnNames: ['userId', 'providerType'], 
      name: 'user_identities_user_provider_type_unique'
    }));
  }

  private async createIndexes(queryRunner: QueryRunner): Promise<void> {
    const indexes = [
      { table: 'entity_permissions', name: 'IDX_762bb30dbbec7c4a1b6ed25418', columns: ['resourceType', 'resourceId'] },
      { table: 'entity_permissions', name: 'idx_entity_permissions_invite_code_id', columns: ['inviteCodeId'] },
      { table: 'invite_codes', name: 'idx_invite_codes_code', columns: ['code'] },
      { table: 'invite_codes', name: 'idx_invite_codes_created_by', columns: ['createdBy'] },
      { table: 'invite_codes', name: 'idx_invite_codes_resource_id', columns: ['resourceId'] },
      { table: 'invite_codes', name: 'idx_invite_codes_resource_type', columns: ['resourceType'] },
      { table: 'invite_codes', name: 'idx_invite_codes_resource_type_id', columns: ['resourceType', 'resourceId'] },
      { table: 'logs', name: 'idx_logs_context', columns: ['context'] },
      { table: 'logs', name: 'idx_logs_level', columns: ['level'] },
      { table: 'logs', name: 'idx_logs_timestamp', columns: ['timestamp'] },
      { table: 'system_access_token_requests', name: 'idx_satr_created_at', columns: ['createdAt'] },
      { table: 'system_access_token_requests', name: 'idx_satr_status', columns: ['status'] },
      { table: 'system_access_token_requests', name: 'idx_satr_token_id', columns: ['systemAccessTokenId'] },
      { table: 'system_access_token_requests', name: 'idx_satr_user_id', columns: ['userId'] },
      { table: 'system_access_tokens', name: 'idx_system_access_tokens_requester_identifier', columns: ['requesterIdentifier'] },
    ];

    for (const idx of indexes) {
      const index = new TableIndex({
        name: idx.name,
        columnNames: idx.columns,
      });
      await queryRunner.createIndex(idx.table, index);
    }

    // GIN index for scopes array
    await queryRunner.query(`
      CREATE INDEX idx_system_access_tokens_scopes ON system_access_tokens USING gin (scopes);
    `);
  }

  private async createForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const foreignKeys = [
      { table: 'user_identities', name: 'FK_084cef3785217102f222e90ea7c', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'entity_permissions', name: 'FK_09e201d078038d69a867887a473', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'buckets', name: 'FK_09f4397033140e0ef31484508dd', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'notifications', name: 'FK_0bba33986bae5af0e04aaf52179', columns: ['messageId'], referencedTable: 'messages', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'message_reminders', name: 'FK_114767228b243b843e2294ce00f', columns: ['messageId'], referencedTable: 'messages', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'notification_postpones', name: 'FK_17bf3dde512c912db728935df77', columns: ['messageId'], referencedTable: 'messages', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'attachments', name: 'FK_35138b11d46d53c48ed932afa47', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'admin_subscriptions', name: 'FK_353fb190fc88c006e6d572d3f2e', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'entity_permissions', name: 'FK_4836a1475f0ba4fd2afde877d89', columns: ['grantedById'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'SET NULL' },
      { table: 'user_sessions', name: 'FK_55fa4db8406ed66bc7044328427', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'notification_postpones', name: 'FK_603ce6d2321b1e56f60ac617821', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'notifications', name: 'FK_692a909ee0fa9383e7859f9b406', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'user_access_tokens', name: 'FK_71a030e491d5c8547fc1e38ef82', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'system_access_tokens', name: 'FK_7a3bf3995b07ab82b1e0e4f89f9', columns: ['requesterId'], referencedTable: 'users', referencedColumns: ['id'] },
      { table: 'user_webhooks', name: 'FK_7c580b7fb06f0f52c67bc7ee6d4', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'message_reminders', name: 'FK_84fe42f2b1d5053dd0d2a8553db', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'payload_mappers', name: 'FK_866d80ad44fe014216aa41c6e67', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'user_settings', name: 'FK_94fedd2ef46f60827473a21f4b7', columns: ['deviceId'], referencedTable: 'user_devices', referencedColumns: ['id'], onDelete: 'SET NULL' },
      { table: 'user_settings', name: 'FK_986a2b6d3c05eb4091bb8066f78', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'messages', name: 'FK_9fa01f3703b45a7aebfd1faa1bb', columns: ['bucketId'], referencedTable: 'buckets', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'notification_postpones', name: 'FK_a8b7caec8c4252adea409fe8ae4', columns: ['notificationId'], referencedTable: 'notifications', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'entity_executions', name: 'FK_b61cb15a0dc7b1cb68ef25616a8', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'notifications', name: 'FK_b66380e85de1e7a83d700ba0360', columns: ['userDeviceId'], referencedTable: 'user_devices', referencedColumns: ['id'], onDelete: 'SET NULL' },
      { table: 'user_devices', name: 'FK_e12ac4f8016243ac71fd2e415af', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'user_buckets', name: 'FK_ee7532b29dac599deba37f44d17', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'user_buckets', name: 'FK_ef82395e59ec96443477f4ef668', columns: ['bucketId'], referencedTable: 'buckets', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'entity_permissions', name: 'fk_entity_permissions_invite_code', columns: ['inviteCodeId'], referencedTable: 'invite_codes', referencedColumns: ['id'], onDelete: 'SET NULL' },
      { table: 'invite_codes', name: 'invite_codes_createdBy_fkey', columns: ['createdBy'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
      { table: 'system_access_token_requests', name: 'system_access_token_requests_systemAccessTokenId_fkey', columns: ['systemAccessTokenId'], referencedTable: 'system_access_tokens', referencedColumns: ['id'], onDelete: 'SET NULL' },
      { table: 'system_access_token_requests', name: 'system_access_token_requests_userId_fkey', columns: ['userId'], referencedTable: 'users', referencedColumns: ['id'], onDelete: 'CASCADE' },
    ];

    for (const fk of foreignKeys) {
      const foreignKey = new TableForeignKey({
        name: fk.name,
        columnNames: fk.columns,
        referencedTableName: fk.referencedTable,
        referencedColumnNames: fk.referencedColumns,
        onDelete: fk.onDelete as any,
      });
      
      try {
        await queryRunner.createForeignKey(fk.table, foreignKey);
      } catch (error: any) {
        if (!error?.message?.includes('already exists')) {
          console.warn(`  ⚠️  Failed to create FK ${fk.name}: ${error?.message}`);
        }
      }
    }
  }

  private async createTriggers(queryRunner: QueryRunner): Promise<void> {
    const triggers = [
      { table: 'invite_codes', name: 'update_invite_codes_updated_at' },
      { table: 'system_access_token_requests', name: 'update_system_access_token_requests_updated_at' },
    ];

    for (const trigger of triggers) {
      await queryRunner.query(`
        CREATE TRIGGER ${trigger.name}
        BEFORE UPDATE ON ${trigger.table}
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
      `);
    }
  }
}
