import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { UserAccessToken } from '../entities/user-access-token.entity';
import { User } from '../entities/user.entity';
import { isUUID } from 'class-validator';
import {
  AccessTokenListDto,
  AccessTokenResponseDto,
  CreateAccessTokenDto,
  UpdateAccessTokenDto,
} from './dto/auth.dto';

export interface AccessTokenValidationResult {
  user: User;
  scopes: string[];
}

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
    const fullToken = `zat_${token}`;

    // Hash the token for storage
    const tokenHash = await bcrypt.hash(token, 10);

    // Create the access token record
    const accessToken = this.accessTokenRepository.create({
      name: createDto.name,
      tokenHash,
      expiresAt: createDto.expiresAt,
      scopes: createDto.scopes,
      token: createDto.storeToken ? fullToken : undefined,
      userId,
    });

    const savedToken = await this.accessTokenRepository.save(accessToken);

    return {
      token: fullToken,
      id: savedToken.id,
      name: savedToken.name,
      expiresAt: savedToken.expiresAt,
      createdAt: savedToken.createdAt,
      tokenStored: !!createDto.storeToken,
    };
  }

  async validateAccessToken(
    token: string,
  ): Promise<AccessTokenValidationResult | null> {
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

        return {
          user: accessToken.user,
          scopes: accessToken.scopes || [],
        };
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
      token: token.token,
      scopes: token.scopes,
    }));
  }

  async getAccessToken(userId: string, tokenId: string): Promise<AccessTokenListDto> {
    const where = isUUID(tokenId)
      ? ({ id: tokenId, userId } as const)
      : ({ name: tokenId, userId } as const);

    const token = await this.accessTokenRepository.findOne({ where });

    if (!token) {
      throw new NotFoundException(
        'Access token not found or does not belong to you',
      );
    }

    return {
      id: token.id,
      name: token.name,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      lastUsed: token.lastUsed,
      isExpired: token.isExpired,
      token: token.token,
      scopes: token.scopes,
    };
  }

  async getAccessTokensForBucket(
    userId: string,
    bucketId: string,
  ): Promise<AccessTokenListDto[]> {
    const tokens = await this.accessTokenRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Filter tokens that have access to this bucket
    const filteredTokens = tokens.filter((token) => {
      // Empty scopes = admin (can access any bucket)
      if (!token.scopes || token.scopes.length === 0) {
        return true;
      }

      // Check if token has scope for this specific bucket
      const bucketScope = `message-bucket-creation:${bucketId}`;
      return token.scopes.includes(bucketScope);
    });

    return filteredTokens.map((token) => ({
      id: token.id,
      name: token.name,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      lastUsed: token.lastUsed,
      isExpired: token.isExpired,
      token: token.token,
      scopes: token.scopes,
    }));
  }

  async createAccessTokenForBucket(
    userId: string,
    bucketId: string,
    name: string,
  ): Promise<AccessTokenResponseDto> {
    const bucketScope = `message-bucket-creation:${bucketId}`;
    
    return this.createAccessToken(userId, {
      name,
      scopes: [bucketScope],
      storeToken: true,
    });
  }

  async updateAccessToken(
    userId: string,
    tokenId: string,
    updateDto: UpdateAccessTokenDto,
  ): Promise<AccessTokenListDto> {
    const token = await this.accessTokenRepository.findOne({
      where: { id: tokenId, userId },
    });

    if (!token) {
      throw new NotFoundException(
        'Access token not found or does not belong to you',
      );
    }

    token.name = updateDto.name;
    
    // Update expiration if provided
    if (updateDto.expiresAt !== undefined) {
      token.expiresAt = updateDto.expiresAt;
    }
    
    // Update scopes if provided
    if (updateDto.scopes !== undefined) {
      token.scopes = updateDto.scopes;
    }
    
    await this.accessTokenRepository.save(token);

    return {
      id: token.id,
      name: token.name,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      lastUsed: token.lastUsed,
      isExpired: token.expiresAt ? new Date(token.expiresAt) < new Date() : false,
      scopes: token.scopes,
      token: token.token,
    };
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

  /**
   * Create or regenerate Watch token for a user
   * A user can only have one Watch token at a time
   * If a Watch token already exists, it will be deleted before creating a new one
   */
  async createOrRegenerateWatchToken(
    userId: string,
  ): Promise<AccessTokenResponseDto> {
    // Find existing Watch token
    const existingTokens = await this.accessTokenRepository.find({
      where: { userId },
    });

    const watchToken = existingTokens.find(
      (token) => token.scopes?.includes('watch'),
    );

    // Delete existing Watch token if found
    if (watchToken) {
      await this.accessTokenRepository.delete(watchToken.id);
    }

    // Create new Watch token
    return this.createAccessToken(userId, {
      name: 'Watch Token',
      scopes: ['watch'],
      storeToken: true,
    });
  }

  /**
   * Get Watch token for a user (if exists)
   */
  async getWatchToken(userId: string): Promise<AccessTokenListDto | null> {
    const tokens = await this.accessTokenRepository.find({
      where: { userId },
    });

    const watchToken = tokens.find(
      (token) => token.scopes?.includes('watch'),
    );

    if (!watchToken) {
      return null;
    }

    return {
      id: watchToken.id,
      name: watchToken.name,
      expiresAt: watchToken.expiresAt,
      createdAt: watchToken.createdAt,
      lastUsed: watchToken.lastUsed,
      isExpired: watchToken.isExpired,
      token: watchToken.token,
      scopes: watchToken.scopes,
    };
  }

  /**
   * Delete Watch token for a user
   */
  async deleteWatchToken(userId: string): Promise<boolean> {
    const tokens = await this.accessTokenRepository.find({
      where: { userId },
    });

    const watchToken = tokens.find(
      (token) => token.scopes?.includes('watch'),
    );

    if (!watchToken) {
      return false;
    }

    await this.accessTokenRepository.delete(watchToken.id);
    return true;
  }
}
