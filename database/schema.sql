-- Zentik Database Schema
-- This file contains the complete database schema for the Zentik application
-- Generated based on TypeORM entities

-- Drop tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS entity_permissions CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS payload_mappers CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS user_buckets CASCADE;
DROP TABLE IF EXISTS user_webhooks CASCADE;
DROP TABLE IF EXISTS user_access_tokens CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_devices CASCADE;
DROP TABLE IF EXISTS buckets CASCADE;
DROP TABLE IF EXISTS oauth_providers CASCADE;
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

-- Create custom enum types
CREATE TYPE device_platform_enum AS ENUM ('IOS', 'ANDROID', 'WEB');
CREATE TYPE notification_delivery_type_enum AS ENUM ('SILENT', 'NORMAL', 'CRITICAL');
CREATE TYPE http_method_enum AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
CREATE TYPE user_role_enum AS ENUM ('user', 'admin');
CREATE TYPE permission_enum AS ENUM ('read', 'write', 'delete', 'admin');
CREATE TYPE resource_type_enum AS ENUM ('bucket', 'notification', 'user_webhook', 'user_access_token');
CREATE TYPE event_type_enum AS ENUM ('LOGIN', 'LOGIN_OAUTH', 'LOGOUT', 'REGISTER', 'PUSH_PASSTHROUGH', 'MESSAGE', 'NOTIFICATION', 'BUCKET_SHARING', 'BUCKET_UNSHARING', 'DEVICE_REGISTER', 'DEVICE_UNREGISTER', 'ACCOUNT_DELETE');
-- NOTE: ACCOUNT_DELETE added in code; ensure DB enum updated in migrations when applying
CREATE TYPE user_setting_type_enum AS ENUM ('Timezone', 'Language', 'UnencryptOnBigPayload', 'AddIconOnNoMedias');

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
    "deviceId" VARCHAR(255),
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

-- Create views for analytics and reporting

-- View to get notification statistics
CREATE VIEW notification_stats AS
SELECT 
    status,
    "deliveryType",
    COUNT(*) as count,
    COUNT(CASE WHEN ud."onlyLocal" = true THEN 1 END) as only_local_count,
    COUNT(CASE WHEN ud."onlyLocal" = false OR ud."onlyLocal" IS NULL THEN 1 END) as push_enabled_count,
    DATE_TRUNC('day', "createdAt") as date
FROM notifications n
LEFT JOIN user_devices ud ON n."userDeviceId" = ud.id
GROUP BY status, "deliveryType", DATE_TRUNC('day', "createdAt")
ORDER BY date DESC, status, "deliveryType";

-- View to get user device summary
CREATE VIEW user_device_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.username,
    COUNT(ud.id) as device_count,
    COUNT(CASE WHEN ud.platform = 'ios' THEN 1 END) as ios_devices,
    COUNT(CASE WHEN ud.platform = 'android' THEN 1 END) as android_devices,
    COUNT(CASE WHEN ud.platform = 'web' THEN 1 END) as web_devices,
    COUNT(CASE WHEN ud."onlyLocal" = true THEN 1 END) as only_local_devices,
    COUNT(CASE WHEN ud."onlyLocal" = false THEN 1 END) as push_enabled_devices,
    COUNT(ud.id) as total_devices,
    MAX(ud."lastUsed") as last_device_used
FROM users u
LEFT JOIN user_devices ud ON u.id = ud."userId"
GROUP BY u.id, u.email, u.username;

-- View to get bucket notification summary
CREATE VIEW bucket_notification_summary AS
SELECT 
    b.id as bucket_id,
    b.name as bucket_name,
    b."userId" as user_id,
    COUNT(n.id) as total_notifications,
    COUNT(CASE WHEN n.status = 'sent' THEN 1 END) as sent_notifications,
    COUNT(CASE WHEN n.status = 'failed' THEN 1 END) as failed_notifications,
    COUNT(CASE WHEN n.status = 'pending' THEN 1 END) as pending_notifications,
    COUNT(CASE WHEN n.status = 'processing' THEN 1 END) as processing_notifications,
    COUNT(CASE WHEN n.status = 'ready' THEN 1 END) as ready_notifications,
    COUNT(CASE WHEN n."readAt" IS NOT NULL THEN 1 END) as read_notifications,
    COUNT(CASE WHEN n."readAt" IS NULL THEN 1 END) as unread_notifications,
    COUNT(CASE WHEN ud."onlyLocal" = true THEN 1 END) as only_local_notifications,
    COUNT(CASE WHEN ud."onlyLocal" = false OR ud."onlyLocal" IS NULL THEN 1 END) as push_enabled_notifications,
    MAX(n."createdAt") as last_notification_at,
    MAX(n."sentAt") as last_sent_at
FROM buckets b
LEFT JOIN messages m ON b.id = m."bucketId"
LEFT JOIN notifications n ON m.id = n."messageId"
LEFT JOIN user_devices ud ON n."userDeviceId" = ud.id
GROUP BY b.id, b.name, b."userId";

-- View for notification details with user and device info
CREATE VIEW notification_details AS
SELECT 
    n.id,
    m.title,
    m.subtitle,
    m.body,
    m."deliveryType",
    n.status,
    n."readAt",
    n."sentAt",
    n."createdAt",
    b.name as bucket_name,
    u.email as user_email,
    u.username,
    array_agg(ud.platform) as device_platforms,
    array_agg(ud."deviceToken") as device_tokens,
    array_agg(ud."onlyLocal") as device_only_local_flags
FROM notifications n
JOIN users u ON n."userId" = u.id
JOIN messages m ON n."messageId" = m.id
LEFT JOIN buckets b ON m."bucketId" = b.id
LEFT JOIN user_devices ud ON n."userDeviceId" = ud.id
GROUP BY n.id, m.title, m.subtitle, m.body, m."deliveryType", n.status, n."readAt", n."sentAt", n."createdAt", b.name, u.email, u.username;

-- Materialized views for notifications analytics

-- Per-user daily sent notifications
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notifications_per_user_daily AS
SELECT 
  n."userId" AS "userId",
  DATE_TRUNC('day', n."sentAt") AS "periodStart",
  COUNT(*) AS count
FROM notifications n
WHERE n."sentAt" IS NOT NULL
GROUP BY n."userId", DATE_TRUNC('day', n."sentAt");
CREATE INDEX IF NOT EXISTS idx_mv_npu_daily_user_period ON mv_notifications_per_user_daily ("userId", "periodStart");

-- Per-user weekly sent notifications
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notifications_per_user_weekly AS
SELECT 
  n."userId" AS "userId",
  DATE_TRUNC('week', n."sentAt") AS "periodStart",
  COUNT(*) AS count
FROM notifications n
WHERE n."sentAt" IS NOT NULL
GROUP BY n."userId", DATE_TRUNC('week', n."sentAt");
CREATE INDEX IF NOT EXISTS idx_mv_npu_weekly_user_period ON mv_notifications_per_user_weekly ("userId", "periodStart");

-- Per-user monthly sent notifications
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notifications_per_user_monthly AS
SELECT 
  n."userId" AS "userId",
  DATE_TRUNC('month', n."sentAt") AS "periodStart",
  COUNT(*) AS count
FROM notifications n
WHERE n."sentAt" IS NOT NULL
GROUP BY n."userId", DATE_TRUNC('month', n."sentAt");
CREATE INDEX IF NOT EXISTS idx_mv_npu_monthly_user_period ON mv_notifications_per_user_monthly ("userId", "periodStart");

-- Per-user all-time sent notifications
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notifications_per_user_all_time AS
SELECT 
  n."userId" AS "userId",
  COUNT(*) AS count
FROM notifications n
WHERE n."sentAt" IS NOT NULL
GROUP BY n."userId";
CREATE INDEX IF NOT EXISTS idx_mv_npu_all_time_user ON mv_notifications_per_user_all_time ("userId");

-- Per-system-token daily passthrough events (proxy for sent notifications)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notifications_per_system_token_daily AS
SELECT 
  e."objectId" AS "systemTokenId",
  DATE_TRUNC('day', e."createdAt") AS "periodStart",
  COUNT(*) AS count
FROM events e
WHERE e.type = 'PUSH_PASSTHROUGH'
GROUP BY e."objectId", DATE_TRUNC('day', e."createdAt");
CREATE INDEX IF NOT EXISTS idx_mv_npst_daily_token_period ON mv_notifications_per_system_token_daily ("systemTokenId", "periodStart");

-- Per-system-token weekly
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notifications_per_system_token_weekly AS
SELECT 
  e."objectId" AS "systemTokenId",
  DATE_TRUNC('week', e."createdAt") AS "periodStart",
  COUNT(*) AS count
FROM events e
WHERE e.type = 'PUSH_PASSTHROUGH'
GROUP BY e."objectId", DATE_TRUNC('week', e."createdAt");
CREATE INDEX IF NOT EXISTS idx_mv_npst_weekly_token_period ON mv_notifications_per_system_token_weekly ("systemTokenId", "periodStart");

-- Per-system-token monthly
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notifications_per_system_token_monthly AS
SELECT 
  e."objectId" AS "systemTokenId",
  DATE_TRUNC('month', e."createdAt") AS "periodStart",
  COUNT(*) AS count
FROM events e
WHERE e.type = 'PUSH_PASSTHROUGH'
GROUP BY e."objectId", DATE_TRUNC('month', e."createdAt");
CREATE INDEX IF NOT EXISTS idx_mv_npst_monthly_token_period ON mv_notifications_per_system_token_monthly ("systemTokenId", "periodStart");

-- Per-system-token all-time
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notifications_per_system_token_all_time AS
SELECT 
  e."objectId" AS "systemTokenId",
  COUNT(*) AS count
FROM events e
WHERE e.type = 'PUSH_PASSTHROUGH'
GROUP BY e."objectId";
CREATE INDEX IF NOT EXISTS idx_mv_npst_all_time_token ON mv_notifications_per_system_token_all_time ("systemTokenId");

-- Sample data for development (commented out by default)
/*
-- Sample user
INSERT INTO users (id, email, username, password, "firstName", "lastName") VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'test@example.com', 'testuser', '$2b$10$example_hashed_password', 'Test', 'User');

-- Sample bucket
INSERT INTO buckets (id, name, description, "userId") VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'Test Bucket', 'A test bucket for development', '550e8400-e29b-41d4-a716-446655440000');

-- Sample device
INSERT INTO user_devices (id, "userId", "deviceToken", platform, "onlyLocal") VALUES 
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'sample_device_token_123', 'ios', false);

-- Sample notification
INSERT INTO notifications (id, title, subtitle, body, "deliveryType", "bucketId", "deviceId") VALUES 
('550e8400-e29b-41d4-a716-446655440003', 'Welcome!', 'Thanks for joining', 'Welcome to Zentik! We hope you enjoy using our app and all its features.', 'normal', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002');
*/
