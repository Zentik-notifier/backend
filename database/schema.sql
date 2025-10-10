-- Zentik Database Schema
-- This file contains the complete database schema for the Zentik application
-- Generated based on TypeORM entities

-- Drop tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS entity_permissions CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS payload_mappers CASCADE;
DROP TABLE IF EXISTS entity_executions CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS user_buckets CASCADE;
DROP TABLE IF EXISTS user_webhooks CASCADE;
DROP TABLE IF EXISTS user_access_tokens CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_devices CASCADE;
DROP TABLE IF EXISTS buckets CASCADE;
DROP TABLE IF EXISTS oauth_providers CASCADE;
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS server_settings CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS device_platform_enum CASCADE;
DROP TYPE IF EXISTS notification_delivery_type_enum CASCADE;
DROP TYPE IF EXISTS http_method_enum CASCADE;
DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS permission_enum CASCADE;
DROP TYPE IF EXISTS resource_type_enum CASCADE;
DROP TYPE IF EXISTS event_type_enum CASCADE;
DROP TYPE IF EXISTS user_setting_type_enum CASCADE;
DROP TYPE IF EXISTS oauth_provider_type_enum CASCADE;
DROP TYPE IF EXISTS execution_type_enum CASCADE;
DROP TYPE IF EXISTS execution_status_enum CASCADE;
DROP TYPE IF EXISTS log_level_enum CASCADE;
DROP TYPE IF EXISTS server_setting_type_enum CASCADE;

-- Create custom enum types
CREATE TYPE device_platform_enum AS ENUM ('IOS', 'ANDROID', 'WEB');
CREATE TYPE notification_delivery_type_enum AS ENUM ('SILENT', 'NORMAL', 'CRITICAL');
CREATE TYPE http_method_enum AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
CREATE TYPE user_role_enum AS ENUM ('user', 'admin');
CREATE TYPE permission_enum AS ENUM ('read', 'write', 'delete', 'admin');
CREATE TYPE resource_type_enum AS ENUM ('bucket', 'notification', 'user_webhook', 'user_access_token');
CREATE TYPE event_type_enum AS ENUM ('LOGIN', 'LOGIN_OAUTH', 'LOGOUT', 'REGISTER', 'PUSH_PASSTHROUGH', 'MESSAGE', 'NOTIFICATION', 'BUCKET_SHARING', 'BUCKET_UNSHARING', 'DEVICE_REGISTER', 'DEVICE_UNREGISTER', 'ACCOUNT_DELETE');
-- NOTE: ACCOUNT_DELETE added in code; ensure DB enum updated in migrations when applying
CREATE TYPE user_setting_type_enum AS ENUM ('Timezone', 'Language', 'UnencryptOnBigPayload');
CREATE TYPE oauth_provider_type_enum AS ENUM ('GITHUB', 'GOOGLE', 'CUSTOM');
CREATE TYPE execution_type_enum AS ENUM ('WEBHOOK', 'PAYLOAD_MAPPER');
CREATE TYPE execution_status_enum AS ENUM ('SUCCESS', 'ERROR', 'TIMEOUT');
CREATE TYPE log_level_enum AS ENUM ('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly');
CREATE TYPE server_setting_type_enum AS ENUM (
  'JwtAccessTokenExpiration', 'JwtRefreshTokenExpiration',
  'ApnPush', 'ApnKeyId', 'ApnTeamId', 'ApnPrivateKeyPath', 'ApnBundleId', 'ApnProduction',
  'FirebasePush', 'FirebaseProjectId', 'FirebasePrivateKey', 'FirebaseClientEmail',
  'WebPush', 'VapidSubject',
  'PushNotificationsPassthroughServer', 'PushPassthroughToken',
  'AttachmentsEnabled', 'AttachmentsStoragePath', 'AttachmentsMaxFileSize', 'AttachmentsAllowedMimeTypes',
  'AttachmentsDeleteJobEnabled', 'AttachmentsDeleteCronJob', 'AttachmentsMaxAge',
  'BackupEnabled', 'BackupExecuteOnStart', 'BackupStoragePath', 'BackupMaxToKeep', 'BackupCronJob',
  'MessagesMaxAge', 'MessagesDeleteJobEnabled', 'MessagesDeleteCronJob',
  'EmailEnabled', 'EmailType', 'EmailHost', 'EmailPort', 'EmailSecure', 'EmailUser', 'EmailPass',
  'EmailFrom', 'EmailFromName', 'ResendApiKey',
  'RateLimitTrustProxyEnabled', 'RateLimitForwardHeader', 'RateLimitTtlMs', 'RateLimitLimit',
  'RateLimitBlockMs', 'RateLimitMessagesRps', 'RateLimitMessagesTtlMs',
  'JwtSecret', 'JwtRefreshSecret',
  'CorsOrigin', 'CorsCredentials',
  'LogLevel', 'LogStorageEnabled', 'LogRetentionDays',
  'LokiEnabled', 'LokiUrl', 'LokiUsername', 'LokiPassword', 'LokiLabels', 'LokiBatchSize', 'LokiBatchIntervalMs',
  'PrometheusEnabled'
);

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    "hasPassword" BOOLEAN DEFAULT TRUE NOT NULL,
    "firstName" VARCHAR(255),
    "lastName" VARCHAR(255),
    avatar VARCHAR(255),
    role user_role_enum DEFAULT 'user' NOT NULL,
    "resetToken" VARCHAR(255),
    "resetTokenRequestedAt" TIMESTAMP WITH TIME ZONE,
    "emailConfirmationToken" VARCHAR(255),
    "emailConfirmationTokenRequestedAt" TIMESTAMP WITH TIME ZONE,
    "emailConfirmed" BOOLEAN DEFAULT FALSE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create entity_executions table
CREATE TABLE entity_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type execution_type_enum NOT NULL,
    status execution_status_enum NOT NULL,
    "entityName" VARCHAR(255),
    "entityId" UUID,
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    input TEXT NOT NULL,
    output TEXT,
    errors TEXT,
    "durationMs" BIGINT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create payload_mappers table
CREATE TABLE payload_mappers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    "jsEvalFn" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create events table for system event tracking
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type event_type_enum NOT NULL,
    "userId" VARCHAR(255),
    "objectId" VARCHAR(255),
    "targetId" VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create oauth_providers table
-- This table stores OAuth provider configurations including predefined (GitHub, Google) and custom providers
-- Custom providers require authorizationUrl, tokenUrl, and userInfoUrl to be set
CREATE TABLE oauth_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    "providerId" VARCHAR(255) UNIQUE NOT NULL,
    type oauth_provider_type_enum NOT NULL,
    "clientId" VARCHAR(255) NOT NULL,
    "clientSecret" VARCHAR(255) NOT NULL,
    "callbackUrl" VARCHAR(500),
    scopes TEXT[] NOT NULL,
    "isEnabled" BOOLEAN DEFAULT TRUE NOT NULL,
    "iconUrl" VARCHAR(500),
    color VARCHAR(7), -- Hex color code (e.g., #FF5733)
    "textColor" VARCHAR(7), -- Hex color code for text (e.g., #FFFFFF)
    "authorizationUrl" VARCHAR(500),
    "tokenUrl" VARCHAR(500),
    "userInfoUrl" VARCHAR(500),
    "profileFields" TEXT[],
    "additionalConfig" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create server_settings table
CREATE TABLE server_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "configType" server_setting_type_enum UNIQUE NOT NULL,
    "valueText" TEXT,
    "valueBool" BOOLEAN,
    "valueNumber" INTEGER,
    "possibleValues" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create logs table for database storage
-- Stores application logs for the last N days (configurable via server_settings)
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level log_level_enum NOT NULL,
    message TEXT NOT NULL,
    context VARCHAR(255),
    trace TEXT,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes on logs table for performance
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_context ON logs(context);

-- Create buckets table
CREATE TABLE buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(255),
    description TEXT,
    color VARCHAR(7), -- Hex color code (e.g., #FF5733)
    "isProtected" BOOLEAN DEFAULT FALSE NOT NULL,
    "isPublic" BOOLEAN DEFAULT FALSE NOT NULL,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_buckets table for user-specific bucket metadata
CREATE TABLE user_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "bucketId" UUID NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
    "snoozeUntil" TIMESTAMP WITH TIME ZONE,
    "snoozes" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "bucketId")
);

-- Create user_access_tokens table
CREATE TABLE user_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP WITH TIME ZONE,
    scopes TEXT,
    "lastUsed" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create system_access_tokens table
CREATE TABLE system_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tokenHash" VARCHAR(255) NOT NULL UNIQUE,
    "maxCalls" INTEGER DEFAULT 0 NOT NULL,
    "calls" INTEGER DEFAULT 0 NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE,
    "requesterId" UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Create user_identities table
CREATE TABLE user_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    "providerId" VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    "avatarUrl" VARCHAR(500),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, "providerId")
);

-- Create user_sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "tokenId" VARCHAR(255) NOT NULL UNIQUE,
    "deviceName" VARCHAR(255),
    "operatingSystem" VARCHAR(100),
    browser VARCHAR(100),
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(100),
    "loginProvider" VARCHAR(50),
    location VARCHAR(100),
    "lastActivity" TIMESTAMP WITH TIME ZONE,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Create user_devices table
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "deviceToken" VARCHAR(255),
    platform device_platform_enum NOT NULL,
    "deviceName" VARCHAR(255),
    "deviceModel" VARCHAR(255),
    "osVersion" VARCHAR(255),
    "publicKey" TEXT,
    "privateKey" TEXT,
    "subscriptionFields" JSONB,
    "onlyLocal" BOOLEAN DEFAULT FALSE NOT NULL,
    "lastUsed" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_settings table for per-user and optional per-device configuration
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "deviceId" UUID REFERENCES user_devices(id) ON DELETE SET NULL,
    "configType" user_setting_type_enum NOT NULL,
    "valueText" TEXT,
    "valueBool" BOOLEAN,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "deviceId", "configType")
);

-- Create user_webhooks table
CREATE TABLE user_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    method http_method_enum NOT NULL,
    url TEXT NOT NULL,
    headers JSONB DEFAULT '[]',
    body JSONB,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    body TEXT,
    attachments JSONB,
    actions JSONB,
    "tapAction" JSONB,
    sound VARCHAR(100),
    "deliveryType" notification_delivery_type_enum NOT NULL DEFAULT 'NORMAL',
    "addMarkAsReadAction" BOOLEAN,
    "addOpenNotificationAction" BOOLEAN,
    "addDeleteAction" BOOLEAN,
    snoozes INTEGER[],
    locale VARCHAR(10),
    "bucketId" UUID NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
    "groupId" VARCHAR(255),
    "collapseId" VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table (thin, references message)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error TEXT,
    "readAt" TIMESTAMP WITH TIME ZONE,
    "sentAt" TIMESTAMP WITH TIME ZONE,
    "receivedAt" TIMESTAMP WITH TIME ZONE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "messageId" UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    "userDeviceId" UUID REFERENCES user_devices(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Create entity_permissions table (generic permissions system)
CREATE TABLE entity_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "resourceType" VARCHAR(50) NOT NULL,
    "resourceId" UUID NOT NULL,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "grantedById" UUID REFERENCES users(id) ON DELETE SET NULL,
    permissions text NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("resourceType", "resourceId", "userId")
);

-- Add constraints for oauth_providers table
-- Ensure custom providers have required URLs
ALTER TABLE oauth_providers 
ADD CONSTRAINT check_custom_provider_urls 
CHECK (
  (type != 'CUSTOM') OR 
  (type = 'CUSTOM' AND "authorizationUrl" IS NOT NULL AND "tokenUrl" IS NOT NULL AND "userInfoUrl" IS NOT NULL)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_reset_token ON users("resetToken");
CREATE INDEX idx_payload_mappers_user_id ON payload_mappers("userId");
CREATE INDEX idx_user_access_tokens_user_id ON user_access_tokens("userId");
CREATE INDEX idx_user_access_tokens_token_hash ON user_access_tokens("tokenHash");
CREATE INDEX idx_user_access_tokens_expires_at ON user_access_tokens("expiresAt");
CREATE INDEX idx_user_sessions_user_id ON user_sessions("userId");
CREATE INDEX idx_user_sessions_token_id ON user_sessions("tokenId");
CREATE INDEX idx_user_sessions_expires_at ON user_sessions("expiresAt");
CREATE INDEX idx_user_identities_user_id ON user_identities("userId");
CREATE INDEX idx_user_identities_provider ON user_identities(provider);
CREATE INDEX idx_user_identities_provider_id ON user_identities("providerId");
CREATE INDEX idx_buckets_user_id ON buckets("userId");
CREATE INDEX idx_user_devices_user_id ON user_devices("userId");
CREATE INDEX idx_user_devices_device_token ON user_devices("deviceToken");
CREATE INDEX idx_user_devices_platform ON user_devices(platform);
CREATE INDEX idx_user_devices_only_local ON user_devices("onlyLocal");
CREATE INDEX idx_user_settings_user_id ON user_settings("userId");
CREATE INDEX idx_user_settings_device_id ON user_settings("deviceId");
CREATE INDEX idx_user_settings_type ON user_settings("configType");
CREATE INDEX idx_user_webhooks_user_id ON user_webhooks("userId");
CREATE INDEX idx_user_webhooks_method ON user_webhooks(method);
CREATE INDEX idx_notifications_user_id ON notifications("userId");
CREATE INDEX idx_notifications_received_at ON notifications("receivedAt");
CREATE INDEX idx_notifications_created_at ON notifications("createdAt");
CREATE INDEX idx_notifications_sent_at ON notifications("sentAt");
CREATE INDEX idx_notifications_read_at ON notifications("readAt");
CREATE INDEX idx_notifications_message_id ON notifications("messageId");
CREATE INDEX idx_notifications_user_device_id ON notifications("userDeviceId");
CREATE INDEX idx_messages_bucket_id ON messages("bucketId");
CREATE INDEX idx_entity_permissions_resource_type ON entity_permissions("resourceType");
CREATE INDEX idx_entity_permissions_resource_id ON entity_permissions("resourceId");
CREATE INDEX idx_entity_permissions_user_id ON entity_permissions("userId");
CREATE INDEX idx_entity_permissions_granted_by_id ON entity_permissions("grantedById");
CREATE INDEX idx_entity_permissions_expires_at ON entity_permissions("expiresAt");
CREATE INDEX idx_entity_permissions_resource_type_id ON entity_permissions("resourceType", "resourceId");

-- Create indexes for oauth_providers table
CREATE INDEX idx_oauth_providers_type ON oauth_providers(type);
CREATE INDEX idx_oauth_providers_provider_id ON oauth_providers("providerId");
CREATE INDEX idx_oauth_providers_enabled ON oauth_providers("isEnabled") WHERE "isEnabled" = true;

-- Create a function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update the updatedAt column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payload_mappers_updated_at BEFORE UPDATE ON payload_mappers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_access_tokens_updated_at BEFORE UPDATE ON user_access_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buckets_updated_at BEFORE UPDATE ON buckets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_devices_updated_at BEFORE UPDATE ON user_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
 
CREATE TRIGGER update_user_webhooks_updated_at BEFORE UPDATE ON user_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_identities_updated_at BEFORE UPDATE ON user_identities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
 
CREATE TRIGGER update_entity_permissions_updated_at BEFORE UPDATE ON entity_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_providers_updated_at BEFORE UPDATE ON oauth_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_server_settings_updated_at BEFORE UPDATE ON server_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to manage readAt field based on notification status
CREATE OR REPLACE FUNCTION manage_notification_read_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is changing to anything other than 'sent', clear readAt
    IF NEW.status != 'sent' AND OLD.status != NEW.status THEN
        NEW."readAt" = NULL;
    -- If readAt is being set to a timestamp, automatically set status to 'sent'
    ELSIF NEW."readAt" IS NOT NULL AND OLD."readAt" IS NULL THEN
        NEW.status = 'sent';
    -- If readAt is being cleared (set to NULL), and status was 'sent', set to 'ready'
    ELSIF NEW."readAt" IS NULL AND OLD."readAt" IS NOT NULL AND OLD.status = 'sent' THEN
        NEW.status = 'ready';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically manage readAt based on status changes
CREATE TRIGGER manage_notification_read_status_trigger 
    BEFORE UPDATE ON notifications
    FOR EACH ROW 
    EXECUTE FUNCTION manage_notification_read_status();