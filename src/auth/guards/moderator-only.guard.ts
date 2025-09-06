import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../../users/users.types';

@Injectable()
export class ModeratorOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    let user: any;

    // Extract user from context
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest();
      user = request.user;
    } else {
      const ctx = GqlExecutionContext.create(context);
      const request = ctx.getContext().req;
      user = request.user;
    }

    return user && user.role === UserRole.MODERATOR;
  }
}
