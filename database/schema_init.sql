--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Homebrew)
-- Dumped by pg_dump version 17.5 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: UserSettingType; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public."UserSettingType" AS ENUM (
    'Timezone',
    'Language',
    'UnencryptOnBigPayload',
    'ExpoKey',
    'HomeassistantUrl',
    'HomeassistantToken',
    'AutoAddDeleteAction',
    'AutoAddMarkAsReadAction',
    'AutoAddOpenNotificationAction',
    'DefaultPostpones',
    'DefaultSnoozes',
    'GithubEventsFilter'
);


ALTER TYPE public."UserSettingType" OWNER TO zentik_user;

--
-- Name: attachments_mediatype_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.attachments_mediatype_enum AS ENUM (
    'VIDEO',
    'IMAGE',
    'GIF',
    'AUDIO',
    'ICON'
);


ALTER TYPE public.attachments_mediatype_enum OWNER TO zentik_user;

--
-- Name: device_platform_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.device_platform_enum AS ENUM (
    'IOS',
    'ANDROID',
    'WEB'
);


ALTER TYPE public.device_platform_enum OWNER TO zentik_user;

--
-- Name: entity_executions_status_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.entity_executions_status_enum AS ENUM (
    'SUCCESS',
    'ERROR',
    'TIMEOUT',
    'SKIPPED'
);


ALTER TYPE public.entity_executions_status_enum OWNER TO zentik_user;

--
-- Name: entity_executions_type_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.entity_executions_type_enum AS ENUM (
    'WEBHOOK',
    'PAYLOAD_MAPPER'
);


ALTER TYPE public.entity_executions_type_enum OWNER TO zentik_user;

--
-- Name: events_type_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.events_type_enum AS ENUM (
    'LOGIN',
    'LOGIN_OAUTH',
    'LOGOUT',
    'REGISTER',
    'PUSH_PASSTHROUGH',
    'MESSAGE',
    'NOTIFICATION',
    'NOTIFICATION_ACK',
    'BUCKET_SHARING',
    'BUCKET_UNSHARING',
    'DEVICE_REGISTER',
    'DEVICE_UNREGISTER',
    'ACCOUNT_DELETE',
    'BUCKET_CREATION',
    'SYSTEM_TOKEN_REQUEST_CREATED',
    'SYSTEM_TOKEN_REQUEST_APPROVED',
    'SYSTEM_TOKEN_REQUEST_DECLINED'
);


ALTER TYPE public.events_type_enum OWNER TO zentik_user;

--
-- Name: log_level_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.log_level_enum AS ENUM (
    'error',
    'warn',
    'info',
    'http',
    'verbose',
    'debug',
    'silly'
);


ALTER TYPE public.log_level_enum OWNER TO zentik_user;

--
-- Name: messages_deliverytype_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.messages_deliverytype_enum AS ENUM (
    'SILENT',
    'NORMAL',
    'CRITICAL'
);


ALTER TYPE public.messages_deliverytype_enum OWNER TO zentik_user;

--
-- Name: oauth_provider_type_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.oauth_provider_type_enum AS ENUM (
    'GITHUB',
    'GOOGLE',
    'DISCORD',
    'APPLE',
    'APPLE_SIGNIN',
    'CUSTOM',
    'FACEBOOK',
    'MICROSOFT'
);


ALTER TYPE public.oauth_provider_type_enum OWNER TO zentik_user;

--
-- Name: payload_mappers_builtinname_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.payload_mappers_builtinname_enum AS ENUM (
    'ZENTIK_AUTHENTIK',
    'ZENTIK_SERVARR',
    'ZENTIK_RAILWAY',
    'ZENTIK_GITHUB',
    'ZENTIK_EXPO',
    'ZENTIK_STATUS_IO',
    'ZENTIK_INSTATUS'
);


ALTER TYPE public.payload_mappers_builtinname_enum OWNER TO zentik_user;

--
-- Name: server_setting_type_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.server_setting_type_enum AS ENUM (
    'JwtAccessTokenExpiration',
    'JwtRefreshTokenExpiration',
    'ApnPush',
    'ApnKeyId',
    'ApnTeamId',
    'ApnPrivateKeyPath',
    'ApnBundleId',
    'ApnProduction',
    'FirebasePush',
    'FirebaseProjectId',
    'FirebasePrivateKey',
    'FirebaseClientEmail',
    'WebPush',
    'VapidSubject',
    'PushNotificationsPassthroughServer',
    'PushPassthroughToken',
    'AttachmentsEnabled',
    'AttachmentsStoragePath',
    'AttachmentsMaxFileSize',
    'AttachmentsAllowedMimeTypes',
    'AttachmentsDeleteJobEnabled',
    'AttachmentsMaxAge',
    'BackupEnabled',
    'BackupExecuteOnStart',
    'BackupStoragePath',
    'BackupMaxToKeep',
    'BackupCronJob',
    'MessagesMaxAge',
    'MessagesDeleteJobEnabled',
    'EmailEnabled',
    'EmailType',
    'EmailHost',
    'EmailPort',
    'EmailSecure',
    'EmailUser',
    'EmailPass',
    'EmailFrom',
    'EmailFromName',
    'ResendApiKey',
    'RateLimitTrustProxyEnabled',
    'RateLimitForwardHeader',
    'RateLimitTtlMs',
    'RateLimitLimit',
    'RateLimitBlockMs',
    'RateLimitMessagesRps',
    'RateLimitMessagesTtlMs',
    'JwtSecret',
    'JwtRefreshSecret',
    'CorsOrigin',
    'CorsCredentials',
    'LogLevel',
    'LogStorageEnabled',
    'LogRetentionDays',
    'PrometheusEnabled',
    'ServerStableIdentifier',
    'EnableSystemTokenRequests',
    'SystemTokenUsageStats',
    'ServerFilesDirectory'
);


ALTER TYPE public.server_setting_type_enum OWNER TO zentik_user;

--
-- Name: system_access_token_request_status; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.system_access_token_request_status AS ENUM (
    'pending',
    'approved',
    'declined'
);


ALTER TYPE public.system_access_token_request_status OWNER TO zentik_user;

--
-- Name: user_setting_type_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.user_setting_type_enum AS ENUM (
    'Timezone',
    'Language',
    'UnencryptOnBigPayload',
    'ExpoKey',
    'HomeassistantUrl',
    'HomeassistantToken',
    'AutoAddDeleteAction',
    'AutoAddMarkAsReadAction',
    'AutoAddOpenNotificationAction',
    'DefaultPostpones',
    'DefaultSnoozes',
    'GithubEventsFilter',
    'ServerStableIdentifier',
    'AppleAuthResponse',
    'GoogleAuthResponse'
);


ALTER TYPE public.user_setting_type_enum OWNER TO zentik_user;

--
-- Name: user_webhooks_method_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.user_webhooks_method_enum AS ENUM (
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE'
);


ALTER TYPE public.user_webhooks_method_enum OWNER TO zentik_user;

--
-- Name: users_role_enum; Type: TYPE; Schema: public; Owner: zentik_user
--

CREATE TYPE public.users_role_enum AS ENUM (
    'user',
    'moderator',
    'admin'
);


ALTER TYPE public.users_role_enum OWNER TO zentik_user;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: zentik_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO zentik_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_subscriptions; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.admin_subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "eventTypes" text[] DEFAULT '{}'::text[] NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_subscriptions OWNER TO zentik_user;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    filename character varying NOT NULL,
    filepath character varying NOT NULL,
    "mediaType" public.attachments_mediatype_enum,
    "messageId" character varying,
    "userId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "originalFilename" character varying,
    size bigint
);


ALTER TABLE public.attachments OWNER TO zentik_user;

--
-- Name: buckets; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.buckets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    icon character varying,
    description character varying,
    color character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid,
    "isProtected" boolean DEFAULT false NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    "isAdmin" boolean DEFAULT false NOT NULL,
    "iconAttachmentUuid" character varying
);


ALTER TABLE public.buckets OWNER TO zentik_user;

--
-- Name: entity_executions; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.entity_executions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type public.entity_executions_type_enum NOT NULL,
    status public.entity_executions_status_enum NOT NULL,
    "entityName" character varying,
    "entityId" character varying,
    "userId" uuid NOT NULL,
    input text NOT NULL,
    output text,
    errors text,
    "durationMs" bigint,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.entity_executions OWNER TO zentik_user;

--
-- Name: entity_permissions; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.entity_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "resourceType" character varying NOT NULL,
    "resourceId" uuid NOT NULL,
    permissions text NOT NULL,
    "expiresAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid,
    "grantedById" uuid,
    "inviteCodeId" uuid
);


ALTER TABLE public.entity_permissions OWNER TO zentik_user;

--
-- Name: events; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type public.events_type_enum NOT NULL,
    "userId" character varying,
    "objectId" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "targetId" character varying
);


ALTER TABLE public.events OWNER TO zentik_user;

--
-- Name: invite_codes; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.invite_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    "resourceType" character varying(50) NOT NULL,
    "resourceId" uuid NOT NULL,
    "createdBy" uuid NOT NULL,
    permissions text NOT NULL,
    "expiresAt" timestamp with time zone,
    "usageCount" integer DEFAULT 0 NOT NULL,
    "maxUses" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.invite_codes OWNER TO zentik_user;

--
-- Name: logs; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    level public.log_level_enum NOT NULL,
    message text NOT NULL,
    context text,
    trace text,
    metadata jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.logs OWNER TO zentik_user;

--
-- Name: message_reminders; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.message_reminders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "messageId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "remindEveryMinutes" integer NOT NULL,
    "maxReminders" integer DEFAULT 5 NOT NULL,
    "remindersSent" integer DEFAULT 0 NOT NULL,
    "nextReminderAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.message_reminders OWNER TO zentik_user;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    subtitle character varying,
    body character varying,
    attachments json,
    "attachmentUuids" text[],
    actions json,
    "tapAction" json,
    sound character varying,
    "deliveryType" public.messages_deliverytype_enum DEFAULT 'NORMAL'::public.messages_deliverytype_enum NOT NULL,
    "addMarkAsReadAction" boolean,
    "addOpenNotificationAction" boolean,
    "addDeleteAction" boolean,
    snoozes integer[],
    locale character varying,
    "bucketId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "groupId" character varying,
    "collapseId" character varying,
    postpones integer[],
    "remindEveryMinutes" integer,
    "maxReminders" integer DEFAULT 5,
    "executionId" character varying
);


ALTER TABLE public.messages OWNER TO zentik_user;

--
-- Name: COLUMN messages."executionId"; Type: COMMENT; Schema: public; Owner: zentik_user
--

COMMENT ON COLUMN public.messages."executionId" IS 'ID of the entity execution that generated this message';


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO zentik_user;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: zentik_user
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO zentik_user;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: zentik_user
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notification_postpones; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.notification_postpones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "notificationId" uuid NOT NULL,
    "messageId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "sendAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_postpones OWNER TO zentik_user;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "receivedAt" timestamp without time zone,
    "readAt" timestamp without time zone,
    error character varying,
    "sentAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid NOT NULL,
    "userDeviceId" uuid,
    "messageId" uuid
);


ALTER TABLE public.notifications OWNER TO zentik_user;

--
-- Name: oauth_providers; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.oauth_providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    type character varying NOT NULL,
    "clientId" character varying NOT NULL,
    "clientSecret" character varying NOT NULL,
    "callbackUrl" character varying,
    scopes text NOT NULL,
    "isEnabled" boolean DEFAULT true NOT NULL,
    "iconUrl" character varying,
    color character varying,
    "textColor" character varying,
    "authorizationUrl" character varying,
    "tokenUrl" character varying,
    "userInfoUrl" character varying,
    "profileFields" text,
    "additionalConfig" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.oauth_providers OWNER TO zentik_user;

--
-- Name: payload_mappers; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.payload_mappers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid,
    name character varying NOT NULL,
    "builtInName" public.payload_mappers_builtinname_enum,
    "jsEvalFn" text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "requiredUserSettings" public."UserSettingType"[]
);


ALTER TABLE public.payload_mappers OWNER TO zentik_user;

--
-- Name: server_settings; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.server_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "configType" public.server_setting_type_enum NOT NULL,
    "valueText" text,
    "valueBool" boolean,
    "valueNumber" integer,
    "possibleValues" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.server_settings OWNER TO zentik_user;

--
-- Name: system_access_token_requests; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.system_access_token_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "systemAccessTokenId" uuid,
    "plainTextToken" text,
    "maxRequests" integer NOT NULL,
    status public.system_access_token_request_status DEFAULT 'pending'::public.system_access_token_request_status NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.system_access_token_requests OWNER TO zentik_user;

--
-- Name: system_access_tokens; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.system_access_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tokenHash" character varying NOT NULL,
    "maxCalls" integer DEFAULT 0 NOT NULL,
    calls integer DEFAULT 0 NOT NULL,
    "expiresAt" timestamp without time zone,
    "requesterId" uuid,
    description text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    "requesterIdentifier" text,
    token text,
    "totalCalls" integer DEFAULT 0 NOT NULL,
    "lastResetAt" timestamp with time zone
);


ALTER TABLE public.system_access_tokens OWNER TO zentik_user;

--
-- Name: typeorm_metadata; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.typeorm_metadata (
    type character varying NOT NULL,
    database character varying,
    schema character varying,
    "table" character varying,
    name character varying,
    value text
);


ALTER TABLE public.typeorm_metadata OWNER TO zentik_user;

--
-- Name: user_access_tokens; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.user_access_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    "tokenHash" character varying NOT NULL,
    "expiresAt" timestamp without time zone,
    scopes text,
    "lastUsed" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid NOT NULL,
    token text
);


ALTER TABLE public.user_access_tokens OWNER TO zentik_user;

--
-- Name: user_buckets; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.user_buckets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "bucketId" uuid NOT NULL,
    "snoozeUntil" timestamp with time zone,
    snoozes jsonb DEFAULT '[]'::jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_buckets OWNER TO zentik_user;

--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.user_devices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "deviceToken" character varying(255),
    platform public.device_platform_enum NOT NULL,
    "deviceName" character varying,
    "deviceModel" character varying,
    "osVersion" character varying,
    "publicKey" text,
    "privateKey" text,
    "subscriptionFields" jsonb,
    "onlyLocal" boolean DEFAULT false NOT NULL,
    "lastUsed" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_devices OWNER TO zentik_user;

--
-- Name: user_identities; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.user_identities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email text,
    "avatarUrl" text,
    "userId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    metadata text,
    "providerType" public.oauth_provider_type_enum
);


ALTER TABLE public.user_identities OWNER TO zentik_user;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "tokenId" character varying(255) NOT NULL,
    "deviceName" character varying(255),
    "operatingSystem" character varying(255),
    browser character varying(100),
    "ipAddress" character varying(45),
    "userAgent" character varying(500),
    "loginProvider" character varying(50),
    "lastActivity" timestamp without time zone,
    "expiresAt" timestamp without time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "exchangeCode" text,
    "exchangeCodeRequestedAt" timestamp without time zone
);


ALTER TABLE public.user_sessions OWNER TO zentik_user;

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "deviceId" uuid,
    "configType" public.user_setting_type_enum NOT NULL,
    "valueText" text,
    "valueBool" boolean,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_settings OWNER TO zentik_user;

--
-- Name: user_webhooks; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.user_webhooks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    method public.user_webhooks_method_enum NOT NULL,
    url text NOT NULL,
    headers jsonb DEFAULT '[]'::jsonb NOT NULL,
    body jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid
);


ALTER TABLE public.user_webhooks OWNER TO zentik_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: zentik_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying NOT NULL,
    username character varying NOT NULL,
    password character varying NOT NULL,
    "hasPassword" boolean DEFAULT true NOT NULL,
    "firstName" character varying,
    "lastName" character varying,
    avatar character varying,
    role public.users_role_enum DEFAULT 'user'::public.users_role_enum NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "resetToken" text,
    "resetTokenRequestedAt" timestamp without time zone,
    "emailConfirmationToken" text,
    "emailConfirmationTokenRequestedAt" timestamp without time zone,
    "emailConfirmed" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO zentik_user;

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: user_settings PK_00f004f5922a0744d174530d639; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT "PK_00f004f5922a0744d174530d639" PRIMARY KEY (id);


--
-- Name: messages PK_18325f38ae6de43878487eff986; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY (id);


--
-- Name: entity_permissions PK_1874a06a289e8ae8f6e72a4200d; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.entity_permissions
    ADD CONSTRAINT "PK_1874a06a289e8ae8f6e72a4200d" PRIMARY KEY (id);


--
-- Name: events PK_40731c7151fe4be3116e45ddf73; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY (id);


--
-- Name: message_reminders PK_56b8595397ace0f2413e9163441; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.message_reminders
    ADD CONSTRAINT "PK_56b8595397ace0f2413e9163441" PRIMARY KEY (id);


--
-- Name: attachments PK_5e1f050bcff31e3084a1d662412; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY (id);


--
-- Name: buckets PK_6274370d823fcc89d22efd86580; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.buckets
    ADD CONSTRAINT "PK_6274370d823fcc89d22efd86580" PRIMARY KEY (id);


--
-- Name: notifications PK_6a72c3c0f683f6462415e653c3a; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);


--
-- Name: payload_mappers PK_7095461f4746e6f6024cd90a59d; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.payload_mappers
    ADD CONSTRAINT "PK_7095461f4746e6f6024cd90a59d" PRIMARY KEY (id);


--
-- Name: oauth_providers PK_80f70fba4177502d50482d9735b; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.oauth_providers
    ADD CONSTRAINT "PK_80f70fba4177502d50482d9735b" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: user_buckets PK_afa1704d7871c28779b86b7f602; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_buckets
    ADD CONSTRAINT "PK_afa1704d7871c28779b86b7f602" PRIMARY KEY (id);


--
-- Name: server_settings PK_b21f0228613e1ab26ce82505cc4; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.server_settings
    ADD CONSTRAINT "PK_b21f0228613e1ab26ce82505cc4" PRIMARY KEY (id);


--
-- Name: notification_postpones PK_b97539d91c59989e4d948e5e21e; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.notification_postpones
    ADD CONSTRAINT "PK_b97539d91c59989e4d948e5e21e" PRIMARY KEY (id);


--
-- Name: user_devices PK_c9e7e648903a9e537347aba4371; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT "PK_c9e7e648903a9e537347aba4371" PRIMARY KEY (id);


--
-- Name: entity_executions PK_d59a0c4a38d4244901cdbde0677; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.entity_executions
    ADD CONSTRAINT "PK_d59a0c4a38d4244901cdbde0677" PRIMARY KEY (id);


--
-- Name: user_webhooks PK_e0553766d8e1b6c9e33f0080d48; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_webhooks
    ADD CONSTRAINT "PK_e0553766d8e1b6c9e33f0080d48" PRIMARY KEY (id);


--
-- Name: user_identities PK_e23bff04e9c3e7b785e442b262c; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT "PK_e23bff04e9c3e7b785e442b262c" PRIMARY KEY (id);


--
-- Name: user_sessions PK_e93e031a5fed190d4789b6bfd83; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY (id);


--
-- Name: admin_subscriptions PK_edadd14352d5f427c91380fbcfd; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.admin_subscriptions
    ADD CONSTRAINT "PK_edadd14352d5f427c91380fbcfd" PRIMARY KEY (id);


--
-- Name: system_access_tokens PK_eef6c020162d5d6253601d7360c; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.system_access_tokens
    ADD CONSTRAINT "PK_eef6c020162d5d6253601d7360c" PRIMARY KEY (id);


--
-- Name: user_access_tokens PK_f07c49baf74e5d699c83e2ec2bd; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_access_tokens
    ADD CONSTRAINT "PK_f07c49baf74e5d699c83e2ec2bd" PRIMARY KEY (id);


--
-- Name: logs PK_fb1b805f2f7795de79fa69340ba; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT "PK_fb1b805f2f7795de79fa69340ba" PRIMARY KEY (id);


--
-- Name: user_access_tokens UQ_011c33b5d78dc4af83d0859715d; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_access_tokens
    ADD CONSTRAINT "UQ_011c33b5d78dc4af83d0859715d" UNIQUE ("tokenHash");


--
-- Name: entity_permissions UQ_2d277076aeb8cf3acc0e6b1411e; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.entity_permissions
    ADD CONSTRAINT "UQ_2d277076aeb8cf3acc0e6b1411e" UNIQUE ("resourceType", "resourceId", "userId");


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: server_settings UQ_e8d540d888136ac10a6133d2c46; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.server_settings
    ADD CONSTRAINT "UQ_e8d540d888136ac10a6133d2c46" UNIQUE ("configType");


--
-- Name: users UQ_fe0bb3f6520ee0469504521e710; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE (username);


--
-- Name: invite_codes invite_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_code_key UNIQUE (code);


--
-- Name: invite_codes invite_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_pkey PRIMARY KEY (id);


--
-- Name: system_access_token_requests system_access_token_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.system_access_token_requests
    ADD CONSTRAINT system_access_token_requests_pkey PRIMARY KEY (id);


--
-- Name: user_identities user_identities_user_provider_type_unique; Type: CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_user_provider_type_unique UNIQUE ("userId", "providerType");


--
-- Name: IDX_762bb30dbbec7c4a1b6ed25418; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX "IDX_762bb30dbbec7c4a1b6ed25418" ON public.entity_permissions USING btree ("resourceType", "resourceId");


--
-- Name: idx_entity_permissions_invite_code_id; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_entity_permissions_invite_code_id ON public.entity_permissions USING btree ("inviteCodeId");


--
-- Name: idx_invite_codes_code; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_invite_codes_code ON public.invite_codes USING btree (code);


--
-- Name: idx_invite_codes_created_by; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_invite_codes_created_by ON public.invite_codes USING btree ("createdBy");


--
-- Name: idx_invite_codes_resource_id; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_invite_codes_resource_id ON public.invite_codes USING btree ("resourceId");


--
-- Name: idx_invite_codes_resource_type; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_invite_codes_resource_type ON public.invite_codes USING btree ("resourceType");


--
-- Name: idx_invite_codes_resource_type_id; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_invite_codes_resource_type_id ON public.invite_codes USING btree ("resourceType", "resourceId");


--
-- Name: idx_logs_context; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_logs_context ON public.logs USING btree (context);


--
-- Name: idx_logs_level; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_logs_level ON public.logs USING btree (level);


--
-- Name: idx_logs_timestamp; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_logs_timestamp ON public.logs USING btree ("timestamp");


--
-- Name: idx_satr_created_at; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_satr_created_at ON public.system_access_token_requests USING btree ("createdAt");


--
-- Name: idx_satr_status; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_satr_status ON public.system_access_token_requests USING btree (status);


--
-- Name: idx_satr_token_id; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_satr_token_id ON public.system_access_token_requests USING btree ("systemAccessTokenId");


--
-- Name: idx_satr_user_id; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_satr_user_id ON public.system_access_token_requests USING btree ("userId");


--
-- Name: idx_system_access_tokens_requester_identifier; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_system_access_tokens_requester_identifier ON public.system_access_tokens USING btree ("requesterIdentifier");


--
-- Name: idx_system_access_tokens_scopes; Type: INDEX; Schema: public; Owner: zentik_user
--

CREATE INDEX idx_system_access_tokens_scopes ON public.system_access_tokens USING gin (scopes);


--
-- Name: invite_codes update_invite_codes_updated_at; Type: TRIGGER; Schema: public; Owner: zentik_user
--

CREATE TRIGGER update_invite_codes_updated_at BEFORE UPDATE ON public.invite_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_access_token_requests update_system_access_token_requests_updated_at; Type: TRIGGER; Schema: public; Owner: zentik_user
--

CREATE TRIGGER update_system_access_token_requests_updated_at BEFORE UPDATE ON public.system_access_token_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_identities FK_084cef3785217102f222e90ea7c; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT "FK_084cef3785217102f222e90ea7c" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: entity_permissions FK_09e201d078038d69a867887a473; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.entity_permissions
    ADD CONSTRAINT "FK_09e201d078038d69a867887a473" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: buckets FK_09f4397033140e0ef31484508dd; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.buckets
    ADD CONSTRAINT "FK_09f4397033140e0ef31484508dd" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications FK_0bba33986bae5af0e04aaf52179; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_0bba33986bae5af0e04aaf52179" FOREIGN KEY ("messageId") REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_reminders FK_114767228b243b843e2294ce00f; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.message_reminders
    ADD CONSTRAINT "FK_114767228b243b843e2294ce00f" FOREIGN KEY ("messageId") REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: notification_postpones FK_17bf3dde512c912db728935df77; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.notification_postpones
    ADD CONSTRAINT "FK_17bf3dde512c912db728935df77" FOREIGN KEY ("messageId") REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: attachments FK_35138b11d46d53c48ed932afa47; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT "FK_35138b11d46d53c48ed932afa47" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: admin_subscriptions FK_353fb190fc88c006e6d572d3f2e; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.admin_subscriptions
    ADD CONSTRAINT "FK_353fb190fc88c006e6d572d3f2e" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: entity_permissions FK_4836a1475f0ba4fd2afde877d89; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.entity_permissions
    ADD CONSTRAINT "FK_4836a1475f0ba4fd2afde877d89" FOREIGN KEY ("grantedById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_sessions FK_55fa4db8406ed66bc7044328427; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT "FK_55fa4db8406ed66bc7044328427" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_postpones FK_603ce6d2321b1e56f60ac617821; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.notification_postpones
    ADD CONSTRAINT "FK_603ce6d2321b1e56f60ac617821" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications FK_692a909ee0fa9383e7859f9b406; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_access_tokens FK_71a030e491d5c8547fc1e38ef82; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_access_tokens
    ADD CONSTRAINT "FK_71a030e491d5c8547fc1e38ef82" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: system_access_tokens FK_7a3bf3995b07ab82b1e0e4f89f9; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.system_access_tokens
    ADD CONSTRAINT "FK_7a3bf3995b07ab82b1e0e4f89f9" FOREIGN KEY ("requesterId") REFERENCES public.users(id);


--
-- Name: user_webhooks FK_7c580b7fb06f0f52c67bc7ee6d4; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_webhooks
    ADD CONSTRAINT "FK_7c580b7fb06f0f52c67bc7ee6d4" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: message_reminders FK_84fe42f2b1d5053dd0d2a8553db; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.message_reminders
    ADD CONSTRAINT "FK_84fe42f2b1d5053dd0d2a8553db" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payload_mappers FK_866d80ad44fe014216aa41c6e67; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.payload_mappers
    ADD CONSTRAINT "FK_866d80ad44fe014216aa41c6e67" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_settings FK_94fedd2ef46f60827473a21f4b7; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT "FK_94fedd2ef46f60827473a21f4b7" FOREIGN KEY ("deviceId") REFERENCES public.user_devices(id) ON DELETE SET NULL;


--
-- Name: user_settings FK_986a2b6d3c05eb4091bb8066f78; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages FK_9fa01f3703b45a7aebfd1faa1bb; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "FK_9fa01f3703b45a7aebfd1faa1bb" FOREIGN KEY ("bucketId") REFERENCES public.buckets(id) ON DELETE CASCADE;


--
-- Name: notification_postpones FK_a8b7caec8c4252adea409fe8ae4; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.notification_postpones
    ADD CONSTRAINT "FK_a8b7caec8c4252adea409fe8ae4" FOREIGN KEY ("notificationId") REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: entity_executions FK_b61cb15a0dc7b1cb68ef25616a8; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.entity_executions
    ADD CONSTRAINT "FK_b61cb15a0dc7b1cb68ef25616a8" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications FK_b66380e85de1e7a83d700ba0360; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_b66380e85de1e7a83d700ba0360" FOREIGN KEY ("userDeviceId") REFERENCES public.user_devices(id) ON DELETE SET NULL;


--
-- Name: user_devices FK_e12ac4f8016243ac71fd2e415af; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_buckets FK_ee7532b29dac599deba37f44d17; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_buckets
    ADD CONSTRAINT "FK_ee7532b29dac599deba37f44d17" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_buckets FK_ef82395e59ec96443477f4ef668; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.user_buckets
    ADD CONSTRAINT "FK_ef82395e59ec96443477f4ef668" FOREIGN KEY ("bucketId") REFERENCES public.buckets(id) ON DELETE CASCADE;


--
-- Name: entity_permissions fk_entity_permissions_invite_code; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.entity_permissions
    ADD CONSTRAINT fk_entity_permissions_invite_code FOREIGN KEY ("inviteCodeId") REFERENCES public.invite_codes(id) ON DELETE SET NULL;


--
-- Name: invite_codes invite_codes_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT "invite_codes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: system_access_token_requests system_access_token_requests_systemAccessTokenId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.system_access_token_requests
    ADD CONSTRAINT "system_access_token_requests_systemAccessTokenId_fkey" FOREIGN KEY ("systemAccessTokenId") REFERENCES public.system_access_tokens(id) ON DELETE SET NULL;


--
-- Name: system_access_token_requests system_access_token_requests_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zentik_user
--

ALTER TABLE ONLY public.system_access_token_requests
    ADD CONSTRAINT "system_access_token_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO zentik_user;


--
-- PostgreSQL database dump complete
--

