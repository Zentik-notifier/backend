import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
    ThrottlerGuard,
    ThrottlerModuleOptions,
    ThrottlerStorage,
    getOptionsToken,
    getStorageToken,
} from '@nestjs/throttler';

@Injectable()
export class ThrottlerUserOrIpGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (!req) {
      return 'ip:unknown';
    }

    // Prefer user id if present (authenticated routes)
    const maybeUser: any = (req as any)?.user;
    const userId: string | undefined = maybeUser?.id || maybeUser?._id || maybeUser?.userId;
    if (userId) {
      return `user:${String(userId)}`;
    }

    // Otherwise, fall back to client IP (public routes)
    const trustProxy = this.getBooleanEnv('RATE_LIMIT_TRUST_PROXY', false);
    const fwdHeader = (this.configService.get<string>('RATE_LIMIT_FORWARD_HEADER') || 'x-forwarded-for').toLowerCase();

    let ip = '';
    if (trustProxy) {
      const headerVal = (req.headers?.[fwdHeader] || req.headers?.['x-forwarded-for']) as string | string[] | undefined;
      if (Array.isArray(headerVal)) {
        ip = headerVal[0] || '';
      } else if (typeof headerVal === 'string' && headerVal.length > 0) {
        // Could be a list: "client, proxy1, proxy2"
        ip = headerVal.split(',')[0].trim();
      }
    }

    if (!ip) {
      // Fallbacks to standard Express/Nest request ip
      ip = (req.ip || req.connection?.remoteAddress || '') as string;
    }

    return `ip:${ip || 'unknown'}`;
  }

  protected getRequestResponse(context: ExecutionContext): { req: Record<string, any>; res: Record<string, any> } {
    // Use base implementation to extract req/res
    let { req, res } = super.getRequestResponse(context);

    // Ensure objects exist
    req = req || {};
    res = res || {};

    // Normalize a compatible header setter for throttler internals
    if (typeof (res as any).header !== 'function') {
      if (typeof (res as any).setHeader === 'function') {
        (res as any).header = (name: string, value: any) => (res as any).setHeader(name, value);
      } else {
        (res as any).header = () => {};
      }
    }

    return { req, res };
  }

  private getBooleanEnv(key: string, defaultValue: boolean): boolean {
    const raw = this.configService.get<string | boolean | undefined>(key);
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      const val = raw.toLowerCase();
      return val === 'true' || val === '1' || val === 'yes';
    }
    return defaultValue;
  }
}


