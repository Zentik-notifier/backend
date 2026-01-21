import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AccessTokenScope, canCreateMessageInBucket } from '../dto/auth.dto';
import { SCOPES_KEY, SCOPE_RESOURCE_PARAM_KEY } from '../decorators/require-scopes.decorator';

/**
 * Guard to validate access token scopes for message bucket creation
 * This guard should be used after JwtOrAccessTokenGuard
 * It only validates scopes when the request is authenticated with an access token
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required scopes from the decorator
    const requiredScopes = this.reflector.getAllAndOverride<AccessTokenScope[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no scopes are required, allow access
    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = this.getRequest(context);

    // If authenticated with JWT (not access token), allow access
    // Access tokens have the 'accessTokenScopes' property in the request
    if (!request.accessTokenScopes) {
      return true;
    }

    const tokenScopes = request.accessTokenScopes as string[];

    // Empty scopes array means full access (admin)
    if (!tokenScopes || tokenScopes.length === 0) {
      return true;
    }

    // Handle MESSAGE_BUCKET_CREATION scope
    if (requiredScopes.includes(AccessTokenScope.MESSAGE_BUCKET_CREATION)) {
      // Get bucket parameter name
      const bucketParamName = this.reflector.getAllAndOverride<string>(
        SCOPE_RESOURCE_PARAM_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (!bucketParamName) {
        throw new ForbiddenException(
          'MESSAGE_BUCKET_CREATION scope requires bucket parameter to be specified',
        );
      }

      // Extract bucket ID from request
      const params = this.getParams(context);
      const bucketId = params[bucketParamName];

      if (!bucketId) {
        throw new ForbiddenException(
          `Bucket ID not found in request parameter '${bucketParamName}'`,
        );
      }

      // Check if token can create messages in this bucket
      if (!canCreateMessageInBucket(tokenScopes, bucketId)) {
        throw new ForbiddenException(
          `Access token does not have permission to create messages in bucket '${bucketId}'`,
        );
      }

      return true;
    }

    // Handle WATCH scope - allows access to notification action routes only
    if (requiredScopes.includes(AccessTokenScope.WATCH)) {
      // Check if token has WATCH scope
      if (!tokenScopes.includes(AccessTokenScope.WATCH)) {
        throw new ForbiddenException(
          'Access token does not have WATCH scope',
        );
      }

      return true;
    }

    throw new ForbiddenException(
      `Access token does not have required scopes`,
    );
  }

  private getParams(context: ExecutionContext): any {
    if (context.getType<any>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getArgs();
    }

    const request = context.switchToHttp().getRequest();
    
    // Check both params and body for bucket ID
    return {
      ...request.params,
      ...request.body,
      ...request.query,
    };
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

