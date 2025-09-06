import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Injects the validated SystemAccessToken attached by SystemAccessTokenGuard.
 * Usage: @GetSystemAccessToken() or @GetSystemAccessToken('id')
 */
export const GetSystemAccessToken = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    // GraphQL context support
    const gqlContext = GqlExecutionContext.create(ctx);
    if (gqlContext.getType() === 'graphql') {
      const context = gqlContext.getContext();
      const sat = context.req?.systemAccessToken;
      return data ? sat?.[data] : sat;
    }

    // HTTP context
    const request = ctx.switchToHttp().getRequest();
    const sat = request.systemAccessToken;
    return data ? sat?.[data] : sat;
  },
);
