import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServerSetting, ServerSettingType } from '../entities/server-setting.entity';
import { CreateServerSettingDto, UpdateServerSettingDto } from './dto/server-setting.dto';

@Injectable()
export class ServerSettingsService {
  private readonly logger = new Logger(ServerSettingsService.name);

  constructor(
    @InjectRepository(ServerSetting)
    private readonly serverSettingsRepository: Repository<ServerSetting>,
  ) {}

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
      defaultValue?: string | boolean | number;
      possibleValues?: string[];
    }> = [
      // JWT
      { configType: ServerSettingType.JwtAccessTokenExpiration, envKey: 'JWT_ACCESS_TOKEN_EXPIRATION', type: 'number', defaultValue: 120 },
      { configType: ServerSettingType.JwtRefreshTokenExpiration, envKey: 'JWT_REFRESH_TOKEN_EXPIRATION', type: 'number', defaultValue: 120 },
      
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
      { configType: ServerSettingType.WebPush, envKey: 'WEB_PUSH', type: 'string', defaultValue: 'Off', possibleValues: ['Off', 'Local', 'Onboard', 'Passthrough'] },
      { configType: ServerSettingType.VapidSubject, envKey: 'VAPID_SUBJECT', type: 'string' },
      
      // Push Passthrough
      { configType: ServerSettingType.PushNotificationsPassthroughServer, envKey: 'PUSH_NOTIFICATIONS_PASSTHROUGH_SERVER', type: 'string' },
      { configType: ServerSettingType.PushPassthroughToken, envKey: 'PUSH_PASSTHROUGH_TOKEN', type: 'string' },
      
      // Attachments
      { configType: ServerSettingType.AttachmentsEnabled, envKey: 'ATTACHMENTS_ENABLED', type: 'boolean', defaultValue: false },
      { configType: ServerSettingType.AttachmentsStoragePath, envKey: 'ATTACHMENTS_STORAGE_PATH', type: 'string' },
      { configType: ServerSettingType.AttachmentsMaxFileSize, envKey: 'ATTACHMENTS_MAX_FILE_SIZE', type: 'number', defaultValue: 10485760 },
      { configType: ServerSettingType.AttachmentsAllowedMimeTypes, envKey: 'ATTACHMENTS_ALLOWED_MIME_TYPES', type: 'string' },
      { configType: ServerSettingType.AttachmentsDeleteJobEnabled, envKey: 'ATTACHMENTS_DELETE_JOB_ENABLED', type: 'boolean', defaultValue: true },
      { configType: ServerSettingType.AttachmentsDeleteCronJob, envKey: 'ATTACHMENTS_DELETE_CRON_JOB', type: 'string', defaultValue: '0 0 * * * *' },
      { configType: ServerSettingType.AttachmentsMaxAge, envKey: 'ATTACHMENTS_MAX_AGE', type: 'string', defaultValue: '7d' },
      
      // Backup
      { configType: ServerSettingType.BackupEnabled, envKey: 'BACKUP_ENABLED', type: 'boolean', defaultValue: false },
      { configType: ServerSettingType.BackupExecuteOnStart, envKey: 'BACKUP_EXECUTE_ON_START', type: 'boolean', defaultValue: true },
      { configType: ServerSettingType.BackupStoragePath, envKey: 'BACKUP_STORAGE_PATH', type: 'string' },
      { configType: ServerSettingType.BackupMaxToKeep, envKey: 'BACKUP_MAX_TO_KEEP', type: 'number', defaultValue: 10 },
      { configType: ServerSettingType.BackupCronJob, envKey: 'BACKUP_CRON_JOB', type: 'string', defaultValue: '0 */12 * * *' },
      
      // Messages
      { configType: ServerSettingType.MessagesMaxAge, envKey: 'MESSAGES_MAX_AGE', type: 'string', defaultValue: '7d' },
      { configType: ServerSettingType.MessagesDeleteJobEnabled, envKey: 'MESSAGES_DELETE_JOB_ENABLED', type: 'boolean', defaultValue: true },
      { configType: ServerSettingType.MessagesDeleteCronJob, envKey: 'MESSAGES_DELETE_CRON_JOB', type: 'string', defaultValue: '0 * * * *' },
      
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
      
      // JWT Secrets
      { configType: ServerSettingType.JwtSecret, envKey: 'JWT_SECRET', type: 'string' },
      { configType: ServerSettingType.JwtRefreshSecret, envKey: 'JWT_REFRESH_SECRET', type: 'string' },
      
      // CORS
      { configType: ServerSettingType.CorsOrigin, envKey: 'CORS_ORIGIN', type: 'string', defaultValue: '*' },
      { configType: ServerSettingType.CorsCredentials, envKey: 'CORS_CREDENTIALS', type: 'boolean', defaultValue: true },
      
      // Logging
      { configType: ServerSettingType.LogLevel, envKey: 'LOG_LEVEL', type: 'string', defaultValue: 'info', possibleValues: ['error', 'warn', 'info', 'debug', 'verbose'] },
      { configType: ServerSettingType.LogStorageEnabled, envKey: 'LOG_STORAGE_ENABLED', type: 'boolean', defaultValue: true },
      { configType: ServerSettingType.LogRetentionDays, envKey: 'LOG_RETENTION_DAYS', type: 'number', defaultValue: 3 },
      
      // Loki Remote Logging
      { configType: ServerSettingType.LokiEnabled, envKey: 'LOKI_ENABLED', type: 'boolean', defaultValue: false },
      { configType: ServerSettingType.LokiUrl, envKey: 'LOKI_URL', type: 'string' },
      { configType: ServerSettingType.LokiUsername, envKey: 'LOKI_USERNAME', type: 'string' },
      { configType: ServerSettingType.LokiPassword, envKey: 'LOKI_PASSWORD', type: 'string' },
      { configType: ServerSettingType.LokiLabels, envKey: 'LOKI_LABELS', type: 'string', defaultValue: 'app=zentik-notifier,environment=production' },
      { configType: ServerSettingType.LokiBatchSize, envKey: 'LOKI_BATCH_SIZE', type: 'number', defaultValue: 100 },
      { configType: ServerSettingType.LokiBatchIntervalMs, envKey: 'LOKI_BATCH_INTERVAL_MS', type: 'number', defaultValue: 5000 },
      
      // Prometheus
      { configType: ServerSettingType.PrometheusEnabled, envKey: 'PROMETHEUS_ENABLED', type: 'boolean', defaultValue: false },
      { configType: ServerSettingType.PrometheusPath, envKey: 'PROMETHEUS_PATH', type: 'string', defaultValue: '/metrics' },
    ];

    for (const mapping of envMappings) {
      const envValue = process.env[mapping.envKey];
      const valueToUse = envValue !== undefined ? envValue : mapping.defaultValue;
      
      // Skip if no env value and no default
      if (valueToUse === undefined) {
        continue;
      }

      const dto: CreateServerSettingDto = {
        configType: mapping.configType,
        valueText: null,
        valueBool: null,
        valueNumber: null,
        possibleValues: mapping.possibleValues ?? null,
      };

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

      // Always upsert: creates if missing, updates only structure (possibleValues) if exists
      const existing = await this.getSettingByType(mapping.configType);
      if (!existing) {
        // Create new setting with env/default value
        await this.upsertSetting(dto);
        this.logger.log(`Created ${mapping.configType} = ${valueToUse}`);
      } else {
        // Update only possibleValues to keep it in sync, preserve user-modified values
        if (mapping.possibleValues && 
            JSON.stringify(existing.possibleValues) !== JSON.stringify(mapping.possibleValues)) {
          existing.possibleValues = mapping.possibleValues;
          await this.serverSettingsRepository.save(existing);
          this.logger.log(`Updated possibleValues for ${mapping.configType}`);
        }
      }
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
