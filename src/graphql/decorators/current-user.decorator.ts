import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
  (field: string | undefined, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user;

    // Allow undefined user for magic code requests
    // The service will resolve the userId from the magic code
    if (!user) {
      return undefined;
    }

    return field ? user[field] : user;
  },
);
