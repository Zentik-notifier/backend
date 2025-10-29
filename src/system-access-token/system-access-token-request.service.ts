import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  SystemAccessTokenRequest,
  SystemAccessTokenRequestStatus,
} from './system-access-token-request.entity';
import { SystemAccessToken } from './system-access-token.entity';
import { User } from '../entities/user.entity';
import { SystemAccessTokenService } from './system-access-token.service';
import {
  CreateSystemAccessTokenRequestDto,
  ApproveSystemAccessTokenRequestDto,
  DeclineSystemAccessTokenRequestDto,
} from './dto';
import { EmailService } from '../auth/email.service';
import { LocaleService } from '../common/services/locale.service';
import { Locale } from '../common/types/i18n';
import { EventsService } from '../events/events.service';
import { EventType } from '../entities';

@Injectable()
export class SystemAccessTokenRequestService {
  private readonly logger = new Logger(SystemAccessTokenRequestService.name);

  constructor(
    @InjectRepository(SystemAccessTokenRequest)
    private readonly requestRepository: Repository<SystemAccessTokenRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly systemAccessTokenService: SystemAccessTokenService,
    private readonly emailService: EmailService,
    private readonly localeService: LocaleService,
    private readonly configService: ConfigService,
    private readonly eventsService: EventsService,
  ) { }

  /**
   * Create a new system access token request
   */
  async create(
    userId: string,
    dto: CreateSystemAccessTokenRequestDto,
  ): Promise<SystemAccessTokenRequest> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const request = this.requestRepository.create({
      userId,
      maxRequests: dto.maxRequests,
      description: dto.description,
      status: SystemAccessTokenRequestStatus.PENDING,
    });

    const saved = await this.requestRepository.save(request);
    this.logger.log(`Created token request ${saved.id} for user ${userId}`);

    // Track event
    await this.eventsService.createEvent({
      type: EventType.SYSTEM_TOKEN_REQUEST_CREATED,
      userId,
      objectId: saved.id,
    });

    return this.findOne(saved.id);
  }

  /**
   * Approve a request and generate a system access token
   */
  async approve(
    requestId: string,
    dto?: ApproveSystemAccessTokenRequestDto,
  ): Promise<SystemAccessTokenRequest> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new NotFoundException(
        `Request with ID ${requestId} not found`,
      );
    }

    if (request.status !== SystemAccessTokenRequestStatus.PENDING) {
      throw new BadRequestException(
        `Request ${requestId} is already ${request.status}`,
      );
    }

    // Parse expiration date if provided
    let expiresAt: Date | undefined;
    if (dto?.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        throw new BadRequestException('Invalid expiration date format');
      }
    }

    // Generate a new system access token
    const token = await this.systemAccessTokenService.createToken(
      request.maxRequests,
      expiresAt,
      request.userId,
      request.description,
    );

    // Update the request with the token and plain text
    request.systemAccessTokenId = token.id;
    request.plainTextToken = (token as any).rawToken;
    request.status = SystemAccessTokenRequestStatus.APPROVED;

    await this.requestRepository.save(request);

    this.logger.log(
      `Approved token request ${requestId}, generated token ${token.id}`,
    );

    // Track event
    await this.eventsService.createEvent({
      type: EventType.SYSTEM_TOKEN_REQUEST_APPROVED,
      userId: request.userId,
      objectId: request.id,
      targetId: token.id,
    });

    // Send email notification to the user
    await this.sendApprovalEmail(request).catch((error) => {
      this.logger.error(
        `Failed to send approval email for request ${requestId}: ${error.message}`,
      );
    });

    return this.findOne(requestId);
  }

  /**
   * Decline a request
   */
  async decline(
    requestId: string,
    dto?: DeclineSystemAccessTokenRequestDto,
  ): Promise<SystemAccessTokenRequest> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(
        `Request with ID ${requestId} not found`,
      );
    }

    if (request.status !== SystemAccessTokenRequestStatus.PENDING) {
      throw new BadRequestException(
        `Request ${requestId} is already ${request.status}`,
      );
    }

    request.status = SystemAccessTokenRequestStatus.DECLINED;

    // Optionally store the decline reason in description
    if (dto?.reason) {
      request.description = `${request.description || ''}\nDeclined: ${dto.reason}`.trim();
    }

    await this.requestRepository.save(request);

    this.logger.log(`Declined token request ${requestId}`);

    // Track event
    await this.eventsService.createEvent({
      type: EventType.SYSTEM_TOKEN_REQUEST_DECLINED,
      userId: request.userId,
      objectId: request.id,
    });

    // Load user relation for email
    const requestWithUser = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    // Send email notification to the user
    if (requestWithUser?.user) {
      await this.sendDeclineEmail(requestWithUser).catch((error) => {
        this.logger.error(
          `Failed to send decline email for request ${requestId}: ${error.message}`,
        );
      });
    }

    return this.findOne(requestId);
  }

  /**
   * Find all requests
   */
  async findAll(): Promise<SystemAccessTokenRequest[]> {
    return this.requestRepository.find({
      relations: ['user', 'systemAccessToken'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find one request by ID
   */
  async findOne(id: string): Promise<SystemAccessTokenRequest> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: ['user', 'systemAccessToken'],
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    return request;
  }

  /**
   * Find requests by user ID
   */
  async findByUser(userId: string): Promise<SystemAccessTokenRequest[]> {
    return this.requestRepository.find({
      where: { userId },
      relations: ['user', 'systemAccessToken'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Build self-service URL for token requests
   */
  private buildSelfServiceUrl(tokenId?: string): string {
    const frontendUrl = (
      this.configService.get<string>('PUBLIC_UI_URL') ||
      this.configService.get<string>('PUBLIC_BACKEND_URL') ||
      'https://notifier.zentik.app'
    );
    const base = `${frontendUrl}/self-service/token-requests`;
    return tokenId ? `${base}?tokenId=${encodeURIComponent(tokenId)}` : base;
  }

  /**
   * Send approval email to the user
   */
  private async sendApprovalEmail(
    request: SystemAccessTokenRequest,
  ): Promise<void> {
    if (!request.user?.email) {
      this.logger.warn(
        `Cannot send approval email: user email not found for request ${request.id}`,
      );
      return;
    }

    const isEmailEnabled = await this.emailService.isEmailEnabled();
    if (!isEmailEnabled) {
      this.logger.warn('Email service is not enabled, skipping approval email');
      return;
    }

    const locale: Locale = (request.user as any).locale || 'en-EN';
    const tokenId = request.systemAccessTokenId || request.systemAccessToken?.id;
    const selfServiceUrl = this.buildSelfServiceUrl(tokenId || undefined);

    const subject = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestApproved.subject',
    );
    const title = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestApproved.title',
    );
    const description = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestApproved.description',
    );
    const instructions = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestApproved.instructions',
    );
    const selfServiceLinkText = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestApproved.selfServiceLink',
    );
    const regards = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestApproved.regards',
    );
    const team = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestApproved.team',
    );

    const html = `
      <h1>${title}</h1>
      <p>${description}</p>
      <p>${instructions}</p>
      <br>
      <p><a href="${selfServiceUrl}" style="color: #1976d2; text-decoration: underline;">${selfServiceLinkText}</a></p>
      <br>
      <p>${regards}<br>${team}</p>
    `;

    const text = `${subject}

${title}

${description}

${instructions}

${selfServiceLinkText}: ${selfServiceUrl}

${regards}
${team}`;

    await this.emailService.sendEmail({
      to: request.user.email,
      subject,
      html,
      text,
    });

    this.logger.log(
      `Sent approval email to ${request.user.email} for request ${request.id}`,
    );
  }

  /**
   * Send decline email to the user
   */
  private async sendDeclineEmail(
    request: SystemAccessTokenRequest,
  ): Promise<void> {
    if (!request.user?.email) {
      this.logger.warn(
        `Cannot send decline email: user email not found for request ${request.id}`,
      );
      return;
    }

    const isEmailEnabled = await this.emailService.isEmailEnabled();
    if (!isEmailEnabled) {
      this.logger.warn('Email service is not enabled, skipping decline email');
      return;
    }

    const locale: Locale = (request.user as any).locale || 'en-EN';
    const selfServiceUrl = this.buildSelfServiceUrl();

    const subject = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestDeclined.subject',
    );
    const title = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestDeclined.title',
    );
    const description = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestDeclined.description',
    );
    const instructions = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestDeclined.instructions',
    );
    const selfServiceLinkText = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestDeclined.selfServiceLink',
    );
    const regards = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestDeclined.regards',
    );
    const team = this.localeService.getTranslatedText(
      locale,
      'email.tokenRequestDeclined.team',
    );

    const html = `
      <h1>${title}</h1>
      <p>${description}</p>
      <p>${instructions}</p>
      <br>
      <p><a href="${selfServiceUrl}" style="color: #1976d2; text-decoration: underline;">${selfServiceLinkText}</a></p>
      <br>
      <p>${regards}<br>${team}</p>
    `;

    const text = `${subject}

${title}

${description}

${instructions}

${selfServiceLinkText}: ${selfServiceUrl}

${regards}
${team}`;

    await this.emailService.sendEmail({
      to: request.user.email,
      subject,
      html,
      text,
    });

    this.logger.log(
      `Sent decline email to ${request.user.email} for request ${request.id}`,
    );
  }
}
