import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServerSetting, ServerSettingType } from '../entities/server-setting.entity';
import { CreateServerSettingDto, UpdateServerSettingDto } from './dto/server-setting.dto';
import { v4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class ServerSettingsService {
  private readonly logger = new Logger(ServerSettingsService.name);

  constructor(
    @InjectRepository(ServerSetting)
    private readonly serverSettingsRepository: Repository<ServerSetting>,
  ) { }

  /**
   * Get all server settings
   */
  async getAllSettings(): Promise<ServerSetting[]> {
    return this.serverSettingsRepository.find({
      order: { configType: 'ASC' },
    });
  }

  /**
   * Get a specific server setting by type
   */
  async getSettingByType(configType: ServerSettingType): Promise<ServerSetting | null> {
    return this.serverSettingsRepository.findOne({
      where: { configType },
    });
  }

  /**
   * Update an existing server setting (public API)
   */
  async updateSetting(
    configType: ServerSettingType,
    dto: UpdateServerSettingDto,
  ): Promise<ServerSetting> {
    const setting = await this.serverSettingsRepository.findOne({
      where: { configType },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with type ${configType} not found`);
    }

    // Track changes for logging
    const changes: string[] = [];
    const oldValues: any = {};
    const newValues: any = {};

    if (dto.valueText !== undefined && setting.valueText !== dto.valueText) {
      oldValues.valueText = setting.valueText;
      newValues.valueText = dto.valueText;
      changes.push(`valueText: "${setting.valueText}" → "${dto.valueText}"`);
      setting.valueText = dto.valueText;
    }

    if (dto.valueBool !== undefined && setting.valueBool !== dto.valueBool) {
      oldValues.valueBool = setting.valueBool;
      newValues.valueBool = dto.valueBool;
      changes.push(`valueBool: ${setting.valueBool} → ${dto.valueBool}`);
      setting.valueBool = dto.valueBool;
    }

    if (dto.valueNumber !== undefined && setting.valueNumber !== dto.valueNumber) {
      oldValues.valueNumber = setting.valueNumber;
      newValues.valueNumber = dto.valueNumber;
      changes.push(`valueNumber: ${setting.valueNumber} → ${dto.valueNumber}`);
      setting.valueNumber = dto.valueNumber;
    }

    if (changes.length > 0) {
      this.logger.log(
        `🔧 Server setting updated: ${configType}\n` +
        `   Changes: ${changes.join(', ')}`
      );
    } else {
      this.logger.debug(`No changes detected for setting: ${configType}`);
    }

    return this.serverSettingsRepository.save(setting);
  }

  /**
   * Create or update a server setting (private - used only during initialization)
   */
  private async upsertSetting(dto: CreateServerSettingDto): Promise<ServerSetting> {
    let setting = await this.serverSettingsRepository.findOne({
      where: { configType: dto.configType },
    });

    if (setting) {
      // Update existing setting
      setting.valueText = dto.valueText;
      setting.valueBool = dto.valueBool;
      setting.valueNumber = dto.valueNumber;
      setting.possibleValues = dto.possibleValues;
    } else {
      // Create new setting
      setting = this.serverSettingsRepository.create(dto);
    }

    return this.serverSettingsRepository.save(setting);
  }

  /**
   * Initialize default settings from environment variables
   */
  async initializeFromEnv(): Promise<void> {
    this.logger.log('Initializing server settings from environment variables...');

    const envMappings: Array<{
      configType: ServerSettingType;
      envKey: string;
      type: 'string' | 'boolean' | 'number';
      defaultValue?: string | boolean | number | (() => string);
      possibleValues?: string[];
    }> = [
        // JWT
        { configType: ServerSettingType.JwtAccessTokenExpiration, envKey: 'JWT_ACCESS_TOKEN_EXPIRATION', type: 'string', defaultValue: '3h' },
        { configType: ServerSettingType.JwtRefreshTokenExpiration, envKey: 'JWT_REFRESH_TOKEN_EXPIRATION', type: 'string', defaultValue: '7d' },
        { configType: ServerSettingType.JwtSecret, envKey: 'JWT_SECRET', type: 'string', defaultValue: () => crypto.randomBytes(64).toString('hex') },
        { configType: ServerSettingType.JwtRefreshSecret, envKey: 'JWT_REFRESH_SECRET', type: 'string', defaultValue: () => crypto.randomBytes(64).toString('hex') },

        // APN Push
        { configType: ServerSettingType.ApnPush, envKey: 'APN_PUSH', type: 'string', defaultValue: 'Off', possibleValues: ['Off', 'Local', 'Onboard', 'Passthrough'] },
        { configType: ServerSettingType.ApnKeyId, envKey: 'APN_KEY_ID', type: 'string' },
        { configType: ServerSettingType.ApnTeamId, envKey: 'APN_TEAM_ID', type: 'string' },
        { configType: ServerSettingType.ApnPrivateKeyPath, envKey: 'APN_PRIVATE_KEY_PATH', type: 'string' },
        { configType: ServerSettingType.ApnBundleId, envKey: 'APN_BUNDLE_ID', type: 'string' },
        { configType: ServerSettingType.ApnProduction, envKey: 'APN_PRODUCTION', type: 'boolean', defaultValue: true },

        // Firebase Push
        { configType: ServerSettingType.FirebasePush, envKey: 'FIREBASE_PUSH', type: 'string', defaultValue: 'Off', possibleValues: ['Off', 'Local', 'Onboard', 'Passthrough'] },
        { configType: ServerSettingType.FirebaseProjectId, envKey: 'FIREBASE_PROJECT_ID', type: 'string' },
        { configType: ServerSettingType.FirebasePrivateKey, envKey: 'FIREBASE_PRIVATE_KEY', type: 'string' },
        { configType: ServerSettingType.FirebaseClientEmail, envKey: 'FIREBASE_CLIENT_EMAIL', type: 'string' },

        // Web Push
        { configType: ServerSettingType.WebPush, envKey: 'WEB_PUSH', type: 'string', defaultValue: 'Onboard', possibleValues: ['Off', 'Local', 'Onboard', 'Passthrough'] },
        { configType: ServerSettingType.VapidSubject, envKey: 'VAPID_SUBJECT', type: 'string', defaultValue: 'mailto:zentik@notifier.com' },

        // Push Passthrough
        { configType: ServerSettingType.PushNotificationsPassthroughServer, envKey: 'PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER', type: 'string', defaultValue: 'https://notifier-api.zentik.app/api/v1' },
        { configType: ServerSettingType.PushPassthroughToken, envKey: 'PUSH_PASSTHROUGH_TOKEN', type: 'string' },

        // Attachments
        { configType: ServerSettingType.AttachmentsEnabled, envKey: 'ATTACHMENTS_ENABLED', type: 'boolean', defaultValue: false },
        { configType: ServerSettingType.AttachmentsStoragePath, envKey: 'ATTACHMENTS_STORAGE_PATH', type: 'string', defaultValue: '/attachments' },
        { configType: ServerSettingType.AttachmentsMaxFileSize, envKey: 'ATTACHMENTS_MAX_FILE_SIZE', type: 'number', defaultValue: 10485760 },
        { configType: ServerSettingType.AttachmentsAllowedMimeTypes, envKey: 'ATTACHMENTS_ALLOWED_MIME_TYPES', type: 'string' },
        { configType: ServerSettingType.AttachmentsDeleteJobEnabled, envKey: 'ATTACHMENTS_DELETE_JOB_ENABLED', type: 'boolean', defaultValue: true },
        { configType: ServerSettingType.AttachmentsMaxAge, envKey: 'ATTACHMENTS_MAX_AGE', type: 'string', defaultValue: '7d' },

        // Backup
        { configType: ServerSettingType.BackupEnabled, envKey: 'BACKUP_ENABLED', type: 'boolean', defaultValue: false },
        { configType: ServerSettingType.BackupExecuteOnStart, envKey: 'BACKUP_EXECUTE_ON_START', type: 'boolean', defaultValue: true },
        { configType: ServerSettingType.BackupStoragePath, envKey: 'BACKUP_STORAGE_PATH', type: 'string', defaultValue: '/backups' },
        { configType: ServerSettingType.BackupMaxToKeep, envKey: 'BACKUP_MAX_TO_KEEP', type: 'number', defaultValue: 10 },
        { configType: ServerSettingType.BackupCronJob, envKey: 'BACKUP_CRON_JOB', type: 'string', defaultValue: '0 */12 * * *' },

        // Server Files
        { configType: ServerSettingType.ServerFilesDirectory, envKey: 'SERVER_FILES_DIR', type: 'string', defaultValue: '/data' },

        // Messages
        { configType: ServerSettingType.MessagesMaxAge, envKey: 'MESSAGES_MAX_AGE', type: 'string', defaultValue: '7d' },
        { configType: ServerSettingType.MessagesDeleteJobEnabled, envKey: 'MESSAGES_DELETE_JOB_ENABLED', type: 'boolean', defaultValue: true },

        // Email
        { configType: ServerSettingType.EmailEnabled, envKey: 'EMAIL_ENABLED', type: 'boolean', defaultValue: false },
        { configType: ServerSettingType.EmailType, envKey: 'EMAIL_TYPE', type: 'string', defaultValue: 'SMTP', possibleValues: ['SMTP', 'Resend'] },
        { configType: ServerSettingType.EmailHost, envKey: 'EMAIL_HOST', type: 'string' },
        { configType: ServerSettingType.EmailPort, envKey: 'EMAIL_PORT', type: 'number' },
        { configType: ServerSettingType.EmailSecure, envKey: 'EMAIL_SECURE', type: 'boolean' },
        { configType: ServerSettingType.EmailUser, envKey: 'EMAIL_USER', type: 'string' },
        { configType: ServerSettingType.EmailPass, envKey: 'EMAIL_PASS', type: 'string' },
        { configType: ServerSettingType.EmailFrom, envKey: 'EMAIL_FROM', type: 'string' },
        { configType: ServerSettingType.EmailFromName, envKey: 'EMAIL_FROM_NAME', type: 'string' },
        { configType: ServerSettingType.ResendApiKey, envKey: 'RESEND_API_KEY', type: 'string' },

        // Rate Limiting
        { configType: ServerSettingType.RateLimitTrustProxyEnabled, envKey: 'RATE_LIMIT_TRUST_PROXY', type: 'boolean', defaultValue: false },
        { configType: ServerSettingType.RateLimitForwardHeader, envKey: 'RATE_LIMIT_FORWARD_HEADER', type: 'string', defaultValue: 'x-forwarded-for' },
        { configType: ServerSettingType.RateLimitTtlMs, envKey: 'RATE_LIMIT_TTL_MS', type: 'number', defaultValue: 60000 },
        { configType: ServerSettingType.RateLimitLimit, envKey: 'RATE_LIMIT_LIMIT', type: 'number', defaultValue: 100 },
        { configType: ServerSettingType.RateLimitBlockMs, envKey: 'RATE_LIMIT_BLOCK_MS', type: 'number', defaultValue: 10000 },
        { configType: ServerSettingType.RateLimitMessagesRps, envKey: 'RATE_LIMIT_MESSAGES_RPS', type: 'number', defaultValue: 10 },
        { configType: ServerSettingType.RateLimitMessagesTtlMs, envKey: 'RATE_LIMIT_MESSAGES_TTL_MS', type: 'number', defaultValue: 1000 },

        // CORS
        { configType: ServerSettingType.CorsOrigin, envKey: 'CORS_ORIGIN', type: 'string', defaultValue: '*' },
        { configType: ServerSettingType.CorsCredentials, envKey: 'CORS_CREDENTIALS', type: 'boolean', defaultValue: true },

        // Logging
        { configType: ServerSettingType.LogLevel, envKey: 'LOG_LEVEL', type: 'string', defaultValue: 'info', possibleValues: ['error', 'warn', 'info', 'debug', 'verbose'] },
        { configType: ServerSettingType.LogStorageDirectory, envKey: 'LOG_STORAGE_DIRECTORY', type: 'string', defaultValue: '/logs' },
        { configType: ServerSettingType.LogRetentionDays, envKey: 'LOG_RETENTION_DAYS', type: 'number', defaultValue: 7 },

        // UI / Features
        { configType: ServerSettingType.IconUploaderEnabled, envKey: 'ICON_UPLOADER_ENABLED', type: 'boolean', defaultValue: true },

        // Registration
        { configType: ServerSettingType.LocalRegistrationEnabled, envKey: 'LOCAL_REGISTRATION_ENABLED', type: 'boolean', defaultValue: false },
        { configType: ServerSettingType.SocialRegistrationEnabled, envKey: 'SOCIAL_REGISTRATION_ENABLED', type: 'boolean', defaultValue: false },
        { configType: ServerSettingType.SocialLoginEnabled, envKey: 'SOCIAL_LOGIN_ENABLED', type: 'boolean', defaultValue: false },

        // Prometheus
        { configType: ServerSettingType.PrometheusEnabled, envKey: 'PROMETHEUS_ENABLED', type: 'boolean', defaultValue: false },
        { configType: ServerSettingType.EnableSystemTokenRequests, envKey: 'ENABLE_SYSTEM_TOKEN_REQUESTS', type: 'boolean', defaultValue: false },
      ];

    const createdSettings: string[] = [];
    const updatedSettings: string[] = [];

    for (const mapping of envMappings) {
      const envValue = process.env[mapping.envKey];
      const defaultValue = typeof mapping.defaultValue === 'function'
        ? mapping.defaultValue()
        : mapping.defaultValue;
      const valueToUse = envValue !== undefined ? envValue : defaultValue;

      const dto: CreateServerSettingDto = {
        configType: mapping.configType,
        valueText: null,
        valueBool: null,
        valueNumber: null,
        possibleValues: mapping.possibleValues ?? null,
      };

      // Even if valueToUse is undefined (no env and no default), create the setting
      // with null values so it appears in the UI. When a value exists, coerce by type.
      if (valueToUse !== undefined) {
        switch (mapping.type) {
          case 'string':
            dto.valueText = String(valueToUse);
            break;
          case 'boolean':
            if (typeof valueToUse === 'boolean') {
              dto.valueBool = valueToUse;
            } else {
              dto.valueBool = String(valueToUse).toLowerCase() === 'true';
            }
            break;
          case 'number':
            dto.valueNumber = typeof valueToUse === 'number' ? valueToUse : parseInt(String(valueToUse), 10);
            break;
        }
      }

      // Always upsert: creates if missing, updates structure and fills missing values when appropriate
      const existing = await this.getSettingByType(mapping.configType);
      if (!existing) {
        // Create new setting with env/default value
        await this.upsertSetting(dto);
        createdSettings.push(`${mapping.configType}=${valueToUse}`);
      } else {
        let valuesUpdated = false;
        // If the setting exists but its value is still null and an env var is provided,
        // use the env value as initial value (without overriding user-modified settings).
        if (envValue !== undefined) {
          switch (mapping.type) {
            case 'string':
              if (existing.valueText == null && dto.valueText != null) {
                existing.valueText = dto.valueText;
                valuesUpdated = true;
              }
              break;
            case 'boolean':
              if (existing.valueBool == null && dto.valueBool != null) {
                existing.valueBool = dto.valueBool;
                valuesUpdated = true;
              }
              break;
            case 'number':
              if (existing.valueNumber == null && dto.valueNumber != null) {
                existing.valueNumber = dto.valueNumber;
                valuesUpdated = true;
              }
              break;
          }
        }

        let possibleValuesUpdated = false;
        // Keep possibleValues in sync with code defaults
        if (mapping.possibleValues &&
          JSON.stringify(existing.possibleValues) !== JSON.stringify(mapping.possibleValues)) {
          existing.possibleValues = mapping.possibleValues;
          possibleValuesUpdated = true;
        }

        if (valuesUpdated || possibleValuesUpdated) {
          await this.serverSettingsRepository.save(existing);
          if (valuesUpdated) {
            updatedSettings.push(`${mapping.configType} (values from env)`);
          } else if (possibleValuesUpdated) {
            updatedSettings.push(`${mapping.configType} (possibleValues)`);
          }
        }
      }
    }

    // Log once with all changes
    if (createdSettings.length > 0 || updatedSettings.length > 0) {
      this.logger.log({
        message: 'Server settings initialized',
        created: createdSettings.length,
        updated: updatedSettings.length,
        createdSettings: createdSettings.length > 0 ? createdSettings : undefined,
        updatedSettings: updatedSettings.length > 0 ? updatedSettings : undefined,
      });
    }

    // Ensure a stable server identifier exists
    try {
      const stableId = await this.getStringValue(ServerSettingType.ServerStableIdentifier);
      if (!stableId) {
        const id = v4();
        await this.upsertSetting({
          configType: ServerSettingType.ServerStableIdentifier,
          valueText: id,
        });
        this.logger.log(`Generated ServerStableIdentifier: ${id}`);
      } else {
        this.logger.log('ServerStableIdentifier already present');
      }
    } catch (e) {
      this.logger.error('Failed to ensure ServerStableIdentifier', e as any);
    }

    // Initialize System Token Usage Stats with empty JSON
    try {
      const usageStats = await this.getSettingByType(ServerSettingType.SystemTokenUsageStats);
      if (!usageStats) {
        await this.upsertSetting({
          configType: ServerSettingType.SystemTokenUsageStats,
          valueText: '{}',
        });
        this.logger.log('Initialized SystemTokenUsageStats with empty JSON');
      }
    } catch (e) {
      this.logger.error('Failed to initialize SystemTokenUsageStats', e as any);
    }

    this.logger.log('Server settings initialization completed');
  }

  /**
   * Batch update multiple server settings
   */
  async batchUpdateSettings(updates: Array<{ configType: ServerSettingType; valueText?: string | null; valueBool?: boolean | null; valueNumber?: number | null }>): Promise<ServerSetting[]> {
    this.logger.log(`📦 Batch updating ${updates.length} server setting(s)...`);
    const results: ServerSetting[] = [];

    for (const update of updates) {
      const dto: UpdateServerSettingDto = {
        valueText: update.valueText,
        valueBool: update.valueBool,
        valueNumber: update.valueNumber,
      };

      const updated = await this.updateSetting(update.configType, dto);
      results.push(updated);
    }

    this.logger.log(`✅ Batch update completed: ${results.length} setting(s) processed`);
    return results;
  }

  /**
   * Get setting value with type-safe return
   */
  async getStringValue(configType: ServerSettingType, defaultValue?: string): Promise<string | null> {
    const setting = await this.getSettingByType(configType);
    return setting?.valueText ?? defaultValue ?? null;
  }

  async getBooleanValue(configType: ServerSettingType, defaultValue?: boolean): Promise<boolean> {
    const setting = await this.getSettingByType(configType);
    return setting?.valueBool ?? defaultValue ?? false;
  }

  async getNumberValue(configType: ServerSettingType, defaultValue?: number): Promise<number | null> {
    const setting = await this.getSettingByType(configType);
    return setting?.valueNumber ?? defaultValue ?? null;
  }
}
