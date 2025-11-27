import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { AccessTokenService } from '../access-token.service';

@Injectable()
export class JwtOrAccessTokenGuard implements CanActivate {
  private readonly logger = new Logger(JwtOrAccessTokenGuard.name);

  constructor(
    private readonly accessTokenService: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);
    const authHeader = request.headers?.authorization;
    const queryToken = request.query?.token;
    const cookieHeader: string | undefined = request.headers?.cookie;

    let token: string | undefined;

    // Check for token in Authorization header first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer '
    }
    // Fallback to query parameter
    else if (queryToken && typeof queryToken === 'string') {
      token = queryToken as string;
    } else if (cookieHeader) {
      // Try to parse cookies manually (avoid dependency on cookie-parser)
      const cookies: Record<string, string> = {};
      try {
        cookieHeader.split(';').forEach((pair: string) => {
          const idx = pair.indexOf('=');
          if (idx > -1) {
            const k = pair.slice(0, idx).trim();
            const v = decodeURIComponent(pair.slice(idx + 1));
            cookies[k] = v;
          }
        });
        const cookieToken = cookies['zat_access'] || cookies['accessToken'];
        if (cookieToken && typeof cookieToken === 'string') {
          token = cookieToken;
        }
      } catch (e) {
        // ignore cookie parse errors
      }
    }

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    // Check if it's an access token (starts with 'zat_')
    if (token.startsWith('zat_')) {
      return this.validateAccessToken(token, request);
    } else {
      // Allow system access token (sat_) to pass through to route-specific guards
      const authHeader = request.headers?.authorization as string | undefined;
      if (authHeader && authHeader.startsWith('Bearer sat_')) {
        return true; // Let SystemAccessTokenGuard handle validation
      }
      return this.validateJWT(context, request);
    }
  }

  private async validateAccessToken(
    token: string,
    request: any,
  ): Promise<boolean> {
    try {
      const result = await this.accessTokenService.validateAccessToken(token);

      if (!result) {
        throw new UnauthorizedException('Invalid access token');
      }

      request.user = result.user;
      request.accessTokenScopes = result.scopes;
      return true;
    } catch (error) {
      this.logger.error(
        '❌ [JwtOrAccessTokenGuard] Access token validation failed:',
        error.message,
      );
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async validateJWT(
    context: ExecutionContext,
    request: any,
  ): Promise<boolean> {
    try {
      // Create a temporary JWT guard instance
      const jwtGuard = new (AuthGuard('jwt'))();

      // Override getRequest method for this instance
      jwtGuard.getRequest = () => request;

      const result = await jwtGuard.canActivate(context);

      if (result) {
      }

      return result as boolean;
    } catch (error) {
      this.logger.error('JWT validation failed:', error.message);
      throw new UnauthorizedException('Invalid JWT token');
    }
  }

  private getRequest(context: ExecutionContext): any {
    if (context.getType<any>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context).getContext();

      // Handle WebSocket GraphQL subscriptions
      if (ctx.websocketHeader?.connectionParams) {
        const websocketHeader = ctx.websocketHeader?.connectionParams || {};
        return { headers: { ...websocketHeader } };
      }

      return ctx.req;
    }

    return context.switchToHttp().getRequest();
  }
}
