import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { AccessTokenService } from '../access-token.service';

@Injectable()
export class JwtOrAccessTokenGuard implements CanActivate {
  private readonly logger = new Logger(JwtOrAccessTokenGuard.name);

  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);
    const authHeader = request.headers?.authorization;
    const queryToken = request.query?.token;

    let token: string;

    // Check for token in Authorization header first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer '
    }
    // Fallback to query parameter
    else if (queryToken) {
      token = queryToken;
    }
    else {
      throw new UnauthorizedException('No authentication token provided');
    }

    // Allow system access tokens on routes that explicitly opt-in via metadata
    const allowSystemToken = this.reflector.get<boolean>(
      'allowSystemToken',
      context.getHandler(),
    );
    if (allowSystemToken && token.startsWith('sat_')) {
      return true;
    }

    // Check if it's an access token (starts with 'zat_')
    if (token.startsWith('zat_')) {
      return this.validateAccessToken(token, request);
    } else {
      return this.validateJWT(context, request);
    }
  }

  private async validateAccessToken(
    token: string,
    request: any,
  ): Promise<boolean> {
    try {
      const user = await this.accessTokenService.validateAccessToken(token);

      if (!user) {
        throw new UnauthorizedException('Invalid access token');
      }

      request.user = user;
      return true;
    } catch (error) {
      console.error(
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
