import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { LocaleService } from '../common/services/locale.service';
import { Locale } from '../common/types/i18n';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';
import { EventTrackingService } from '../events/event-tracking.service';

export enum EmailProvider {
  SMTP = 'smtp',
  RESEND = 'resend',
}

export interface EmailOptions {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
  cc?: string[];
  bcc?: string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private resend: Resend;
  private provider: EmailProvider;
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private localeService: LocaleService,
    private serverSettingsService: ServerSettingsService,
    private eventTrackingService: EventTrackingService,
  ) {
    this.ensureInitialized().catch(error => {
      this.logger.error('Error initializing email service', error);
    });
  }

  private async ensureInitialized() {
    if (this.initialized) {
      return;
    }
    await this.initializeEmailProvider();
    this.initialized = true;
  }

  private async initializeEmailProvider() {
    // Read EmailType from server settings
    const emailType = await this.serverSettingsService.getStringValue(
      ServerSettingType.EmailType,
      'SMTP',
    );

    if (emailType === 'Resend') {
      this.provider = EmailProvider.RESEND;
      const resendApiKey = await this.serverSettingsService.getStringValue(
        ServerSettingType.ResendApiKey,
      );
      if (resendApiKey) {
        this.resend = new Resend(resendApiKey);
        this.logger.log('Email provider initialized: Resend');
      } else {
        this.logger.warn('Resend selected but API key not configured');
      }
    } else {
      this.provider = EmailProvider.SMTP;
      await this.initializeSMTPTransporter();
    }
  }

  private async initializeSMTPTransporter() {
    const host = await this.serverSettingsService.getStringValue(
      ServerSettingType.EmailHost,
      'smtp.gmail.com',
    );
    const port = await this.serverSettingsService.getNumberValue(
      ServerSettingType.EmailPort,
      587,
    );
    const secure = await this.serverSettingsService.getBooleanValue(
      ServerSettingType.EmailSecure,
      false,
    );
    const user = await this.serverSettingsService.getStringValue(
      ServerSettingType.EmailUser,
    );
    const pass = await this.serverSettingsService.getStringValue(
      ServerSettingType.EmailPass,
    );

    // Provider-specific configurations
    const emailConfig: any = {
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    };

    // Generic SSL/TLS fallback configuration
    if (secure) {
      emailConfig.tls = {
        rejectUnauthorized: false,
        ciphers: 'SSLv3',
      };
    }

    if (emailConfig.auth.user && emailConfig.auth.pass) {
      this.logger.log(
        `Initializing email transporter with config: ${JSON.stringify({
          host: emailConfig.host,
          port: emailConfig.port,
          secure: emailConfig.secure,
          tls: emailConfig.tls ? 'enabled' : 'disabled',
        })}`,
      );

      this.transporter = nodemailer.createTransport(emailConfig);
      this.logger.log('Email transporter initialized successfully');
    } else {
      this.logger.warn(
        'Email credentials not configured, email service will be disabled',
      );
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const mockMode = (process.env.EMAIL_MOCK_MODE || '').toLowerCase();
    if (mockMode === 'success' || mockMode === 'fail') {
      const success = mockMode === 'success';
      this.logger.warn(
        `EMAIL_MOCK_MODE=${mockMode}: mocking email send to ${options.to}`,
      );

      if (success) {
        await this.safeTrackEmailSent(options, 'mock', { mockMode });
      } else {
        await this.safeTrackEmailFailed(
          options,
          'mock',
          'Mocked email failure',
          { mockMode },
        );
      }

      return success;
    }

    await this.ensureInitialized();

    if (this.provider === EmailProvider.RESEND) {
      return this.sendEmailWithResend(options);
    } else {
      return this.sendEmailWithSMTP(options);
    }
  }

  private async sendEmailWithResend(options: EmailOptions): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn('Resend not available, skipping email send');
      return false;
    }

    try {
      const fromEmail =
        options.from ||
        (await this.serverSettingsService.getStringValue(
          ServerSettingType.EmailFrom,
          'noreply@zentik.app',
        ));
      const fromName = await this.serverSettingsService.getStringValue(
        ServerSettingType.EmailFromName,
        'Zentik',
      );
      const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

      const emailPayload: any = {
        from,
        to: [options.to],
        subject: options.subject,
        cc: options.cc,
        bcc: options.bcc,
      };

      // Resend requires either html or text (not both undefined)
      if (options.html) {
        emailPayload.html = options.html;
      }
      if (options.text) {
        emailPayload.text = options.text;
      }

      // If neither html nor text is provided, use a default
      if (!options.html && !options.text) {
        emailPayload.text = options.subject;
      }

      const result = await this.resend.emails.send(emailPayload);

      this.logger.log(
        `Email sent successfully via Resend to ${options.to}, id: ${result.data?.id}`,
      );

      await this.safeTrackEmailSent(options, 'resend', {
        provider: 'Resend',
        id: result.data?.id,
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email via Resend to ${options.to}: ${error.message}`,
      );
      this.logger.error(`Resend error details: ${JSON.stringify(error)}`);

       await this.safeTrackEmailFailed(options, 'resend', error.message, {
         provider: 'Resend',
       });
      return false;
    }
  }

  private async sendEmailWithSMTP(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('SMTP transporter not available, skipping email send');
      return false;
    }

    try {
      const fromEmail =
        options.from ||
        (await this.serverSettingsService.getStringValue(
          ServerSettingType.EmailFrom,
          'noreply@zentik.app',
        ));
      const fromName = await this.serverSettingsService.getStringValue(
        ServerSettingType.EmailFromName,
      );
      const from = fromName ? `${fromName} <${fromEmail || 'noreply@zentik.app'}>` : (fromEmail || 'noreply@zentik.app');

      const mailOptions = {
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        cc: options.cc,
        bcc: options.bcc,
      };

      const result: any = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully via SMTP to ${options.to}, messageId: ${result.messageId || 'unknown'}`,
      );

      await this.safeTrackEmailSent(options, 'smtp', {
        provider: 'SMTP',
        messageId: result.messageId || 'unknown',
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email via SMTP to ${options.to}: ${error.message}`,
      );
      this.logger.error(
        `SMTP error details: ${JSON.stringify({
          code: error.code,
          command: error.command,
          responseCode: error.responseCode,
          response: error.response,
          stack: error.stack,
        })}`,
      );

      await this.safeTrackEmailFailed(options, 'smtp', error.message, {
        provider: 'SMTP',
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
      });
      return false;
    }
  }

  async sendWelcomeEmail(
    email: string,
    username: string,
    locale: Locale = 'en-EN',
  ): Promise<boolean> {
    const subject = this.localeService.getTranslatedText(
      locale,
      'email.welcome.subject',
    );
    const title = this.localeService.getTranslatedText(
      locale,
      'email.welcome.title',
      { username: username },
    );
    const description = this.localeService.getTranslatedText(
      locale,
      'email.welcome.description',
    );
    const instructions = this.localeService.getTranslatedText(
      locale,
      'email.welcome.instructions',
    );
    const regards = this.localeService.getTranslatedText(
      locale,
      'email.welcome.regards',
    );
    const team = this.localeService.getTranslatedText(
      locale,
      'email.welcome.team',
    );

    const html = `
      <h1>${title}</h1>
      <p>${description}</p>
      <p>${instructions}</p>
      <br>
      <p>${regards}<br>${team}</p>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    locale: Locale = 'en-EN',
  ): Promise<boolean> {
    const title = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.title',
    );
    const description = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.description',
    );
    const codeInstructions = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.codeInstructions',
    );
    const important = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.important',
    );
    const instructions1 = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.instructions1',
    );
    const instructions2 = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.instructions2',
    );
    const instructions3 = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.instructions3',
    );
    const regards = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.regards',
    );
    const team = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.team',
    );
    const subject = this.localeService.getTranslatedText(
      locale,
      'email.passwordReset.subject',
    );

    const html = `
      <h1>${title}</h1>
      <p>${description}</p>
      <p>${codeInstructions}</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #333; border: 2px dashed #ccc; background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);">
        ${resetToken}
      </div>
      <p><strong>${important}</strong></p>
      <ul>
        <li>${instructions1}</li>
        <li>${instructions2}</li>
        <li>${instructions3}</li>
      </ul>
      <br>
      <p>${regards}<br>${team}</p>
    `;

    const text = `${subject}

${description}

${codeInstructions}

${resetToken}

${important}
${instructions1}
${instructions2}
${instructions3}

${regards}
${team}`;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async sendNotificationEmail(
    email: string,
    notificationTitle: string,
    notificationBody: string,
  ): Promise<boolean> {
    const subject = `New Notification: ${notificationTitle}`;
    const html = `
      <h2>New Notification</h2>
      <h3>${notificationTitle}</h3>
      <p>${notificationBody}</p>
      <br>
      <p>Check your Zentik app for more details.</p>
      <br>
      <p>Best regards,<br>The Zentik Team</p>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  async sendEmailConfirmation(
    email: string,
    confirmationToken: string,
    locale: Locale = 'en-EN',
  ): Promise<boolean> {
    const subject = this.localeService.getTranslatedText(
      locale,
      'email.confirmation.subject',
    );
    const title = this.localeService.getTranslatedText(
      locale,
      'email.confirmation.title',
    );
    const description = this.localeService.getTranslatedText(
      locale,
      'email.confirmation.description',
    );
    const codeInstructions = this.localeService.getTranslatedText(
      locale,
      'email.confirmation.codeInstructions',
    );
    const important = this.localeService.getTranslatedText(
      locale,
      'email.confirmation.important',
    );
    const instructions1 = this.localeService.getTranslatedText(
      locale,
      'email.confirmation.instructions1',
    );
    const instructions2 = this.localeService.getTranslatedText(
      locale,
      'email.confirmation.instructions2',
    );
    const regards = this.localeService.getTranslatedText(
      locale,
      'email.confirmation.regards',
    );
    const team = this.localeService.getTranslatedText(
      locale,
      'email.confirmation.team',
    );

    const html = `
      <h1>${title}</h1>
      <p>${description}</p>
      <p>${codeInstructions}</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #333; border: 2px dashed #ccc; background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);">
        ${confirmationToken}
      </div>
      <p><strong>${important}</strong></p>
      <ul>
        <li>${instructions1}</li>
        <li>${instructions2}</li>
      </ul>
      <br>
      <p>${regards}<br>${team}</p>
    `;

    const text = `${subject}

${description}

${codeInstructions}

${confirmationToken}

${important}
${instructions1}
${instructions2}

${regards}
${team}`;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async isEmailEnabled(): Promise<boolean> {
    const emailEnabled = await this.serverSettingsService.getBooleanValue(
      ServerSettingType.EmailEnabled,
      false,
    );

    if (!emailEnabled) {
      const mockMode = (process.env.EMAIL_MOCK_MODE || '').toLowerCase();
      if (mockMode === 'success' || mockMode === 'fail') {
        this.logger.warn(
          'Email is disabled via settings but EMAIL_MOCK_MODE is set, treating email as enabled for mock.',
        );
        return true;
      }

      return false;
    }

    // Ensure provider is initialized
    await this.ensureInitialized();

    // Check if the initialized provider is available
    if (this.provider === EmailProvider.RESEND) {
      return !!this.resend;
    } else {
      return !!this.transporter;
    }
  }

  private async safeTrackEmailSent(
    options: EmailOptions,
    provider: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    if (!this.eventTrackingService) {
      return;
    }

    try {
      await this.eventTrackingService.trackEmailSent(
        options.to,
        options.subject,
        provider,
        metadata,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to track EMAIL_SENT event for ${options.to}: ${err?.message}`,
      );
    }
  }

  private async safeTrackEmailFailed(
    options: EmailOptions,
    provider: string,
    error: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    if (!this.eventTrackingService) {
      return;
    }

    try {
      await this.eventTrackingService.trackEmailFailed(
        options.to,
        options.subject,
        provider,
        error,
        metadata,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to track EMAIL_FAILED event for ${options.to}: ${err?.message}`,
      );
    }
  }

  getEmailProvider(): EmailProvider {
    return this.provider;
  }
}
