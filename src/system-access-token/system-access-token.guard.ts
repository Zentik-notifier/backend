import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { SystemAccessTokenService } from './system-access-token.service';

@Injectable()
export class SystemAccessTokenGuard implements CanActivate {
  private readonly logger = new Logger(SystemAccessTokenGuard.name);

  constructor(
    private readonly systemAccessTokenService: SystemAccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);
    const authHeader = request.headers?.authorization as string | undefined;

    // Extract request info for logging
    const method = request.method || 'UNKNOWN';
    const url = request.url || 'UNKNOWN';
    const ip = request.ip || request.headers?.['x-forwarded-for'] || 'UNKNOWN';

    if (!authHeader || !authHeader.startsWith('Bearer sat_')) {
      this.logger.error(
        `System access token format invalid - Method: ${method}, URL: ${url}, IP: ${ip}, AuthHeader: ${authHeader ? authHeader.substring(0, 20) + '...' : 'missing'}`,
      );
      throw new UnauthorizedException('Missing or invalid system access token');
    }

    const token = authHeader.substring(7);
    const rec = await this.systemAccessTokenService.validateSystemToken(token);
    if (!rec) {
      this.logger.warn(
        `System access token invalid or expired - Method: ${method}, URL: ${url}, IP: ${ip}, Token: ${token.substring(0, 20)}...`,
      );
      throw new UnauthorizedException('Invalid or expired system access token');
    }

    // Attach token info to request for downstream usage
    request.systemAccessToken = rec;

    // Note: the increment should be done by the controller/handler that actually performs the action
    // If we want to increment here, uncomment the following line:
    // await this.systemAccessTokenService.incrementCalls(rec.id);

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
