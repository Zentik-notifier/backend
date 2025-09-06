import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from '../auth.service';
import { SessionService } from '../session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback-secret',
      passReqToCallback: true, // This allows us to access the request object
    });
  }

  async validate(req: any, payload: JwtPayload) {
    // Verify that the user still exists
    const user = await this.authService.findById(payload.sub);
    if (!user) {
      // this.logger.warn(
      //   `JWT validation failed - user not found: ${payload.sub}`,
      // );
      return null;
    }

    // Verify that the session is still active
    if (payload.jti) {
      const session = await this.sessionService.getSessionByTokenId(
        payload.jti,
      );
      if (!session || !session.isActive) {
        this.logger.warn(
          `JWT validation failed - session not found or inactive for token: ${payload.jti?.substring(0, 8)}...`,
        );
        return null;
      }

      // Update session activity
      await this.sessionService.updateSessionActivity(payload.jti);
    }

    // Add tokenId to the user object for later use
    return {
      ...user,
      tokenId: payload.jti,
    };
  }
}
