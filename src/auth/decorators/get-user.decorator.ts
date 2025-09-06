import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    // Check if we're in a GraphQL context
    const gqlContext = GqlExecutionContext.create(ctx);
    if (gqlContext.getType() === 'graphql') {
      const context = gqlContext.getContext();
      const user = context.req?.user;
      return data ? user?.[data] : user;
    }

    // HTTP context
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
