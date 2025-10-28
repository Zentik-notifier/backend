import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

export const SYSTEM_SCOPES_KEY = 'required_system_scopes';

/**
 * Guard to validate system access token scopes
 * This guard should be used after SystemAccessTokenGuard
 * It validates that the token has the required scopes
 */
@Injectable()
export class SystemAccessScopesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required scopes from the decorator
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      SYSTEM_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no scopes are required, allow access
    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = this.getRequest(context);

    // Get the system access token from the request (set by SystemAccessTokenGuard)
    const systemAccessToken = (request as any).systemAccessToken;

    if (!systemAccessToken) {
      throw new ForbiddenException('System access token not found');
    }

    // Get token scopes (empty array means full access)
    const tokenScopes = systemAccessToken.scopes || [];

    // Empty scopes array means full access (admin)
    if (tokenScopes.length === 0) {
      return true;
    }

    // Check if all required scopes are present in the token
    for (const requiredScope of requiredScopes) {
      if (!tokenScopes.includes(requiredScope)) {
        throw new ForbiddenException(
          `System access token missing required scope: ${requiredScope}`,
        );
      }
    }

    return true;
  }

  private getRequest(context: ExecutionContext): any {
    if (context.getType<any>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context).getContext();
      if (ctx.websocketHeader?.connectionParams) {
        const websocketHeader = ctx.websocketHeader?.connectionParams || {};
        return { headers: { ...websocketHeader } };
      }
      return ctx.req;
    }
    return context.switchToHttp().getRequest();
  }
}

