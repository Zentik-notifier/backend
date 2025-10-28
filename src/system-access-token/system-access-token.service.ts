import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { SystemAccessToken } from './system-access-token.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class SystemAccessTokenService {
  private readonly logger = new Logger(SystemAccessTokenService.name);

  constructor(
    @InjectRepository(SystemAccessToken)
    private readonly systemTokenRepository: Repository<SystemAccessToken>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createToken(
    maxCalls: number,
    expiresAt?: Date,
    requesterId?: string,
    description?: string,
    scopes?: string[],
  ) {
    // Validate that the requester user exists if provided
    if (requesterId) {
      const user = await this.userRepository.findOne({
        where: { id: requesterId },
      });
      if (!user) {
        throw new BadRequestException(`User with ID ${requesterId} not found`);
      }
    }

    const raw = crypto.randomBytes(24).toString('hex');
    const tokenHash = await bcrypt.hash(raw, 10);

    const rec = this.systemTokenRepository.create({
      tokenHash,
      maxCalls,
      calls: 0,
      expiresAt,
      requesterId,
      description,
      token: `sat_${raw}`,
      scopes,
    });
    const saved = await this.systemTokenRepository.save(rec);

    (saved as any).rawToken = `sat_${raw}`;
    return saved;
  }

  async findAll() {
    return this.systemTokenRepository.find({
      relations: ['requester'],
    });
  }

  async findOne(id: string) {
    return this.systemTokenRepository.findOne({
      where: { id },
      relations: ['requester'],
    });
  }

  async updateToken(
    id: string,
    maxCalls?: number,
    expiresAt?: Date,
    requesterId?: string,
    description?: string,
    scopes?: string[],
  ) {
    // Validate that the requester user exists if provided
    if (requesterId) {
      const user = await this.userRepository.findOne({
        where: { id: requesterId },
      });
      if (!user) {
        throw new BadRequestException(`User with ID ${requesterId} not found`);
      }
    }

    const updateData: any = {};
    if (maxCalls !== undefined) updateData.maxCalls = maxCalls;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
    if (requesterId !== undefined) updateData.requesterId = requesterId;
    if (description !== undefined) updateData.description = description;
    if (scopes !== undefined) updateData.scopes = scopes;

    const result = await this.systemTokenRepository.update(id, updateData);
    if (result.affected === 0) {
      throw new BadRequestException(
        `System access token with ID ${id} not found`,
      );
    }

    return this.systemTokenRepository.findOne({
      where: { id },
      relations: ['requester'],
    });
  }

  async revoke(id: string) {
    const r = await this.systemTokenRepository.delete(id);
    return (r.affected || 0) > 0;
  }

  /**
   * Validate a raw bearer token (e.g., "sat_..."), checking expiration and maxCalls threshold.
   * Returns the matching SystemAccessToken entity if valid, otherwise null.
   * This method DOES NOT increment the calls counter.
   */
  async validateSystemToken(
    bearerToken: string,
  ): Promise<SystemAccessToken | null> {
    try {
      if (!bearerToken || !bearerToken.startsWith('sat_')) {
        this.logger.warn(
          'System token validation failed: invalid token format',
        );
        return null;
      }

      const raw = bearerToken.substring(4);
      const tokens = await this.systemTokenRepository.find({
        relations: ['requester'],
      });

      for (const token of tokens) {
        const matches = await bcrypt.compare(raw, token.tokenHash);
        if (!matches) continue;

        // Check expiration
        if (token.expiresAt && token.expiresAt < new Date()) {
          this.logger.warn(
            `System token ${token.id} has expired (expiresAt: ${token.expiresAt})`,
          );
          return null;
        }

        // Check calls threshold (only if maxCalls > 0)
        if (token.maxCalls > 0 && token.calls >= token.maxCalls) {
          this.logger.warn(
            `System token ${token.id} has exceeded maximum calls (${token.calls}/${token.maxCalls})`,
          );
          return null;
        }

        return token;
      }

      this.logger.warn(
        'System token validation failed: no matching token found',
      );
      return null;
    } catch (err) {
      this.logger.error('System token validation error:', err);
      return null;
    }
  }

  /** Increment the calls counter for a given token id. */
  async incrementCalls(id: string): Promise<void> {
    try {
      await this.systemTokenRepository.increment({ id }, 'calls', 1);
      this.logger.debug(
        `Incremented call count for system access token: ${id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to increment call count for system access token: ${id}`,
        error,
      );
      throw error;
    }
  }
}
