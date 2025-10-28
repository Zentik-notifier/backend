import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(SystemAccessScopesGuard.name);

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

    // Extract request info for logging
    const method = request.method || 'UNKNOWN';
    const url = request.url || 'UNKNOWN';
    const ip = request.ip || request.headers?.['x-forwarded-for'] || 'UNKNOWN';

    // Get the system access token from the request (set by SystemAccessTokenGuard)
    const systemAccessToken = (request as any).systemAccessToken;

    if (!systemAccessToken) {
      this.logger.error(
        `System access token not found - Method: ${method}, URL: ${url}, IP: ${ip}`,
      );
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
        this.logger.warn(
          `System access token missing required scope '${requiredScope}' - Required: [${requiredScopes.join(', ')}], Has: [${tokenScopes.join(', ')}] - Method: ${method}, URL: ${url}, IP: ${ip}`,
        );
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

