import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Locale, Translation, TranslationKeyPath } from '../types/i18n';

@Injectable()
export class LocaleService {
  private readonly logger = new Logger(LocaleService.name);
  private translations: Map<Locale, Translation> = new Map();

  constructor() {
    this.loadTranslations();
  }

  private loadTranslations() {
    try {
      // Try multiple possible paths for the locales directory
      const possiblePaths = [
        // Development path (relative to source)
        path.join(__dirname, '..', 'locales'),
        // Production path (relative to compiled dist)
        path.join(__dirname, '..', 'locales'),
        // Alternative production path
        path.join(__dirname, '..', '..', 'locales'),
        // Production path from dist/src/common/services to dist/common/locales
        path.join(__dirname, '..', '..', '..', 'common', 'locales'),
        // Root project path (fallback)
        path.join(process.cwd(), 'src', 'common', 'locales'),
      ];

      let localesDir: string | null = null;

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          localesDir = possiblePath;
          this.logger.log(`Found locales directory at: ${localesDir}`);
          break;
        }
      }

      if (!localesDir) {
        this.logger.warn(
          `Locales directory not found in any of these paths: ${possiblePaths.join(', ')}`,
        );
        return;
      }

      // Read all JSON files in the locales directory
      const files = fs.readdirSync(localesDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const locale = file.replace('.json', '');
          const filePath = path.join(localesDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          this.translations.set(locale as Locale, data);
          this.logger.log(`Loaded translations for locale: ${locale}`);
        } catch (fileError) {
          this.logger.error(
            `Failed to load translations from ${file}: ${fileError.message}`,
          );
        }
      }

      // Set default locale
      if (!this.translations.has('en-EN')) {
        this.logger.warn('Default English translations not found');
      }

      this.logger.log(
        `Successfully loaded ${this.translations.size} locale(s): ${Array.from(this.translations.keys()).join(', ')}`,
      );
    } catch (error) {
      this.logger.error(`Failed to load translations: ${error.message}`);
    }
  }

  private replacePlaceholders(
    text: string,
    placeholders: Record<string, string>,
  ): string {
    let result = text;
    for (const [key, value] of Object.entries(placeholders)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  getTranslatedText(
    locale: Locale,
    key: TranslationKeyPath,
    placeholders: Record<string, string> = {},
  ): string {
    const translations =
      this.translations.get(locale) || this.translations.get('en-EN');
    const stringKey = key as string;
    if (!translations) {
      this.logger.warn(`Translations not found for locale: ${locale}`);
      return stringKey;
    }

    const keys = stringKey.split('.');
    let value: any = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        this.logger.warn(
          `Translation key not found: ${stringKey} for locale: ${locale}`,
        );
        return stringKey;
      }
    }

    if (typeof value === 'string') {
      return this.replacePlaceholders(value, placeholders);
    }

    return String(value);
  }
}
