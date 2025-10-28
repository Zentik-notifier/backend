import { SetMetadata } from '@nestjs/common';
import { SYSTEM_SCOPES_KEY } from '../system-access-scopes.guard';

/**
 * Decorator to require specific scopes for system access tokens
 * 
 * @param scopes - Array of scope names required to access this endpoint
 * 
 * @example
 * ```typescript
 * // Require 'passthrough' scope
 * @RequireSystemScopes(['passthrough'])
 * @UseGuards(SystemAccessTokenGuard, SystemAccessScopesGuard)
 * @Post('notify-external')
 * async notifyExternal() {
 *   // Only tokens with 'passthrough' scope can access this endpoint
 * }
 * ```
 */
export const RequireSystemScopes = (scopes: string[]) => {
  return SetMetadata(SYSTEM_SCOPES_KEY, scopes);
};

