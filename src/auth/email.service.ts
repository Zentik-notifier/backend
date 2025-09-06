import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { LocaleService } from '../common/services/locale.service';
import { Locale } from '../common/types/i18n';

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

  constructor(
    private configService: ConfigService,
    private localeService: LocaleService,
  ) {
    this.initializeEmailProvider();
  }

  private initializeEmailProvider() {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (resendApiKey) {
      this.provider = EmailProvider.RESEND;
      this.resend = new Resend(resendApiKey);
      this.logger.log('Email provider initialized: Resend');
    } else {
      this.provider = EmailProvider.SMTP;
      this.initializeSMTPTransporter();
    }
  }

  private initializeSMTPTransporter() {
    const host = this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com');
    const port = this.configService.get<number>('EMAIL_PORT', 587);
    const secure =
      this.configService.get<string>('EMAIL_SECURE', 'false') === 'true';

    // Provider-specific configurations
    const emailConfig: any = {
      host,
      port,
      secure,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    };

    // Gmail-specific configuration
    // if (host.includes('gmail.com')) {
    //   emailConfig = {
    //     ...emailConfig,
    //     port: 587,
    //     secure: false, // Use STARTTLS
    //     tls: {
    //       rejectUnauthorized: false,
    //     },
    //   };
    // }

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
        this.configService.get<string>('EMAIL_FROM', 'noreply@zentik.app');
      const fromName = this.configService.get<string>(
        'EMAIL_FROM_NAME',
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
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email via Resend to ${options.to}: ${error.message}`,
      );
      this.logger.error(`Resend error details: ${JSON.stringify(error)}`);
      return false;
    }
  }

  private async sendEmailWithSMTP(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('SMTP transporter not available, skipping email send');
      return false;
    }

    try {
      const mailOptions = {
        from:
          options.from ||
          (() => {
            const fromEmail = this.configService.get<string>(
              'EMAIL_FROM',
              'noreply@zentik.app',
            );
            const fromName = this.configService.get<string>('EMAIL_FROM_NAME');
            return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
          })(),
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        cc: options.cc,
        bcc: options.bcc,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully via SMTP to ${options.to}, messageId: ${result.messageId}`,
      );
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

  isEmailEnabled(): boolean {
    const emailEnabled =
      this.configService.get<string>('EMAIL_ENABLED', 'true') ?? 'true';
    const isEnabled = emailEnabled.toLowerCase() === 'true';

    if (!isEnabled) {
      return false;
    }

    // Check if at least one provider is configured
    const hasResend = !!this.configService.get<string>('RESEND_API_KEY');
    const hasSmtp = !!(
      this.configService.get<string>('EMAIL_USER') &&
      this.configService.get<string>('EMAIL_PASS')
    );

    return hasResend || hasSmtp;
  }

  getEmailProvider(): EmailProvider {
    return this.provider;
  }
}
