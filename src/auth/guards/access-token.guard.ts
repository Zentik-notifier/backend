import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AccessTokenService } from '../access-token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);
    const authHeader = request.headers?.authorization;
    const tokenFromQuery = request.query?.token || request.query?.access_token;

    let token: string | null = null;

    // Check Authorization header first
    if (authHeader && authHeader.startsWith('Bearer zat_')) {
      token = authHeader.substring(7); // Remove 'Bearer '
    }
    // Fallback to query parameter
    else if (tokenFromQuery && typeof tokenFromQuery === 'string' && tokenFromQuery.startsWith('zat_')) {
      token = tokenFromQuery;
    }

    if (!token) {
      return false; // Let JWT guard handle it
    }

    try {
      const user = await this.accessTokenService.validateAccessToken(token);

      if (!user) {
        throw new UnauthorizedException('Invalid access token');
      }

      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid access token');
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
