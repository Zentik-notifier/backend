import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { UserSession } from '../entities/user-session.entity';
import { SessionInfoDto } from './dto/session.dto';

interface DeviceInfo {
  deviceName?: string;
  operatingSystem?: string;
  browser?: string;
  ipAddress?: string;
  userAgent?: string;
  loginProvider?: string; // OAuth provider used for login
  // If provided, update this existing session instead of creating a new one
  sessionId?: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) { }

  async createSession(
    userId: string,
    tokenId: string,
    expiresAt: Date,
    deviceInfo: DeviceInfo = {},
  ): Promise<UserSession> {
    // this.logger.debug(
    //   `Creating session for user: ${userId} with token: ${tokenId.substring(0, 8)}...`,
    // );

    // If a sessionId is provided, update the existing session row (keep the same session entry)
    if (deviceInfo.sessionId) {
      this.logger.debug(
        `Updating existing session ${deviceInfo.sessionId} for user: ${userId}`,
      );
      await this.sessionRepository.update(
        { id: deviceInfo.sessionId, userId },
        {
          tokenId,
          expiresAt,
          lastActivity: new Date(),
          isActive: true,
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          deviceName: deviceInfo.deviceName,
          operatingSystem: deviceInfo.operatingSystem,
          browser: deviceInfo.browser,
          loginProvider: deviceInfo.loginProvider,
        },
      );
      const updated = await this.sessionRepository.findOne({
        where: { id: deviceInfo.sessionId },
      });
      if (updated) {
        this.logger.log(
          `Session updated successfully: ${updated.id} for user: ${userId}`,
        );
        return updated;
      }
      // Fallback: if not found, continue to create a new session
      this.logger.warn(
        `Existing session ${deviceInfo.sessionId} not found, creating a new session instead`,
      );
    }

    const session = this.sessionRepository.create({
      userId,
      tokenId,
      expiresAt,
      lastActivity: new Date(),
      isActive: true,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      deviceName: deviceInfo.deviceName,
      operatingSystem: deviceInfo.operatingSystem,
      browser: deviceInfo.browser,
      loginProvider: deviceInfo.loginProvider,
    });

    const savedSession = await this.sessionRepository.save(session);

    return savedSession;
  }

  async updateSessionActivity(tokenId: string): Promise<void> {
    const result = await this.sessionRepository.update(
      { tokenId, isActive: true },
      { lastActivity: new Date() },
    );
  }

  async getUserSessions(
    userId: string,
    currentTokenId?: string,
  ): Promise<SessionInfoDto[]> {
    const sessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { lastActivity: 'DESC' },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      operatingSystem: session.operatingSystem,
      browser: session.browser,
      ipAddress: session.ipAddress,
      lastActivity: session.lastActivity || session.createdAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.tokenId === currentTokenId,
      isActive: session.isActive,
      loginProvider: session.loginProvider,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    this.logger.debug(`Revoking session: ${sessionId} for user: ${userId}`);

    const result = await this.sessionRepository.update(
      { id: sessionId, userId },
      { isActive: false },
    );

    const revoked = (result.affected ?? 0) > 0;
    if (revoked) {
      this.logger.log(
        `Session revoked successfully: ${sessionId} for user: ${userId}`,
      );
    } else {
      this.logger.warn(
        `Failed to revoke session: ${sessionId} for user: ${userId} - session not found or already inactive`,
      );
    }

    return revoked;
  }

  async revokeAllSessions(
    userId: string,
    exceptTokenId?: string,
  ): Promise<boolean> {
    const whereCondition: any = { userId, isActive: true };

    if (exceptTokenId) {
      whereCondition.tokenId = Not(exceptTokenId);
    }

    const result = await this.sessionRepository.update(whereCondition, {
      isActive: false,
    });

    const revokedCount = result.affected ?? 0;

    return revokedCount > 0;
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.sessionRepository.update(
      {
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
      { isActive: false },
    );
  }

  async getSessionByTokenId(tokenId: string): Promise<UserSession | null> {
    return this.sessionRepository.findOne({
      where: { tokenId, isActive: true, expiresAt: MoreThan(new Date()) },
    });
  }

  async validateRefreshToken(tokenId: string): Promise<UserSession | null> {
    const session = await this.sessionRepository.findOne({
      where: {
        tokenId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
    });

    return session;
  }

  async revokeSessionByRefreshToken(tokenId: string): Promise<boolean> {
    this.logger.debug(
      `Revoking session by tokenId: ${tokenId.substring(0, 8)}...`,
    );

    const result = await this.sessionRepository.update(
      { tokenId, isActive: true },
      { isActive: false },
    );

    const revoked = (result.affected ?? 0) > 0;
    if (revoked) {
      this.logger.log(`Session revoked successfully by tokenId`);
    } else {
      this.logger.warn(
        `Failed to revoke session - tokenId not found or already inactive`,
      );
    }

    return revoked;
  }
}
