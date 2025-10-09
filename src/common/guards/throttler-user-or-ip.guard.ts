import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  getOptionsToken,
  getStorageToken,
} from '@nestjs/throttler';
import { ServerSettingsService } from '../../server-settings/server-settings.service';
import { ServerSettingType } from '../../entities/server-setting.entity';

@Injectable()
export class ThrottlerUserOrIpGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly serverSettingsService: ServerSettingsService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (!req) {
      return 'ip:unknown';
    }

    // Prefer user id if present (authenticated routes)
    const maybeUser: any = (req as any)?.user;
    const userId: string | undefined =
      maybeUser?.id || maybeUser?._id || maybeUser?.userId;
    if (userId) {
      return `user:${String(userId)}`;
    }

    // Otherwise, fall back to client IP (public routes)
    const trustProxy = (await this.serverSettingsService.getSettingByType(ServerSettingType.RateLimitTrustProxyEnabled))?.valueBool ?? false;
    const fwdHeader = (
      (await this.serverSettingsService.getSettingByType(ServerSettingType.RateLimitForwardHeader))?.valueText ||
      'x-forwarded-for'
    ).toLowerCase();

    let ip = '';
    if (trustProxy) {
      const headerVal = (req.headers?.[fwdHeader] ||
        req.headers?.['x-forwarded-for']) as string | string[] | undefined;
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

  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, any>;
    res: Record<string, any>;
  } {
    // Use base implementation to extract req/res
    let { req, res } = super.getRequestResponse(context);

    // Ensure objects exist
    req = req || {};
    res = res || {};

    // Normalize a compatible header setter for throttler internals
    if (typeof (res as any).header !== 'function') {
      if (typeof (res as any).setHeader === 'function') {
        (res as any).header = (name: string, value: any) =>
          (res as any).setHeader(name, value);
      } else {
        (res as any).header = () => {};
      }
    }

    return { req, res };
  }
}
