import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ServerSettingsService } from '../../server-manager/server-settings.service';
import { ServerSettingType } from '../../entities/server-setting.entity';
import { AuthService, JwtPayload } from '../auth.service';
import { SessionService } from '../session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private serverSettingsService: ServerSettingsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => {
          try {
            const cookieHeader: string | undefined = req?.headers?.cookie;
            if (!cookieHeader) return null;
            const cookies: Record<string, string> = {};
            cookieHeader.split(';').forEach((pair: string) => {
              const idx = pair.indexOf('=');
              if (idx > -1) {
                const k = pair.slice(0, idx).trim();
                const v = decodeURIComponent(pair.slice(idx + 1));
                cookies[k] = v;
              }
            });
            return cookies['zat_access'] || cookies['accessToken'] || null;
          } catch {
            return null;
          }
        },
      ]),
      ignoreExpiration: false,
      secretOrKeyProvider: async (request, rawJwtToken, done) => {
        try {
          // Get JWT secret from ServerSettings, fallback to env variable
          const jwtSecret = (await serverSettingsService.getSettingByType(ServerSettingType.JwtSecret))?.valueText 
            || process.env.JWT_SECRET 
            || 'fallback-secret';
          done(null, jwtSecret);
        } catch (error) {
          done(error, undefined);
        }
      },
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
