import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class SystemAccessTokenRequestService {
  private readonly logger = new Logger(SystemAccessTokenRequestService.name);

  constructor(
    @InjectRepository(SystemAccessTokenRequest)
    private readonly requestRepository: Repository<SystemAccessTokenRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly systemAccessTokenService: SystemAccessTokenService,
  ) {}

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
}
