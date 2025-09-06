import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { UserAccessToken } from '../entities/user-access-token.entity';
import { User } from '../entities/user.entity';
import {
  AccessTokenListDto,
  AccessTokenResponseDto,
  CreateAccessTokenDto,
} from './dto/auth.dto';

@Injectable()
export class AccessTokenService {
  constructor(
    @InjectRepository(UserAccessToken)
    private readonly accessTokenRepository: Repository<UserAccessToken>,
    private readonly jwtService: JwtService,
  ) {}

  async createAccessToken(
    userId: string,
    createDto: CreateAccessTokenDto,
  ): Promise<AccessTokenResponseDto> {
    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');

    // Hash the token for storage
    const tokenHash = await bcrypt.hash(token, 10);

    // Create the access token record
    const accessToken = this.accessTokenRepository.create({
      name: createDto.name,
      tokenHash,
      expiresAt: createDto.expiresAt,
      scopes: createDto.scopes,
      userId,
    });

    const savedToken = await this.accessTokenRepository.save(accessToken);

    return {
      token: `zat_${token}`, // Prefix for identification
      id: savedToken.id,
      name: savedToken.name,
      expiresAt: savedToken.expiresAt,
      createdAt: savedToken.createdAt,
    };
  }

  async validateAccessToken(token: string): Promise<User | null> {
    // Remove prefix if present
    const cleanToken = token.startsWith('zat_') ? token.substring(4) : token;

    // Find all access tokens and check against each hash
    const accessTokens = await this.accessTokenRepository.find({
      relations: ['user'],
    });

    for (const accessToken of accessTokens) {
      // Check if token is expired
      if (accessToken.expiresAt && new Date() > accessToken.expiresAt) {
        continue;
      }

      // Verify token hash
      const isValid = await bcrypt.compare(cleanToken, accessToken.tokenHash);
      if (isValid) {
        // Update last used timestamp
        await this.accessTokenRepository.update(accessToken.id, {
          lastUsed: new Date(),
        });

        return accessToken.user;
      }
    }

    return null;
  }

  async getUserAccessTokens(userId: string): Promise<AccessTokenListDto[]> {
    const tokens = await this.accessTokenRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return tokens.map((token) => ({
      id: token.id,
      name: token.name,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      lastUsed: token.lastUsed,
      isExpired: token.isExpired,
    }));
  }

  async revokeAccessToken(userId: string, tokenId: string): Promise<boolean> {
    // First verify that the token exists and belongs to the user
    const token = await this.accessTokenRepository.findOne({
      where: { id: tokenId, userId },
    });

    if (!token) {
      throw new NotFoundException(
        'Access token not found or does not belong to you',
      );
    }

    // Delete the token
    await this.accessTokenRepository.delete({
      id: tokenId,
      userId,
    });

    return true;
  }

  async revokeAllAccessTokens(userId: string): Promise<boolean> {
    // Check if user has any tokens to revoke
    const tokenCount = await this.accessTokenRepository.count({
      where: { userId },
    });

    if (tokenCount === 0) {
      return false; // No tokens to revoke
    }

    await this.accessTokenRepository.delete({ userId });
    return true;
  }
}
