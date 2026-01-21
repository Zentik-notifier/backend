import { SetMetadata } from '@nestjs/common';
import { AccessTokenScope } from '../dto/auth.dto';

export const SCOPES_KEY = 'required_scopes';
export const SCOPE_RESOURCE_PARAM_KEY = 'scope_resource_param';

/**
 * Decorator to require MESSAGE_BUCKET_CREATION scope for an endpoint
 * When used with access tokens, the token must have permission to create messages in the specified bucket
 * JWT tokens are not affected by this decorator
 * 
 * @param bucketParamName - Parameter name to extract bucket ID from request (e.g., 'bucketId')
 * 
 * @example
 * ```typescript
 * // Require MESSAGE_BUCKET_CREATION scope with specific bucket
 * @RequireMessageBucketCreation('bucketId')
 * @Post()
 * async createMessage(@Body() dto: CreateMessageDto) { 
 *   // Token must have "message-bucket-creation:bucket-123" scope
 *   // or "admin" scope
 * }
 * ```
 */
export const RequireMessageBucketCreation = (bucketParamName: string = 'bucketId') => {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (!propertyKey || !descriptor) return;
    
    SetMetadata(SCOPES_KEY, [AccessTokenScope.MESSAGE_BUCKET_CREATION])(target, propertyKey as string, descriptor);
    SetMetadata(SCOPE_RESOURCE_PARAM_KEY, bucketParamName)(target, propertyKey as string, descriptor);
  };
};

/**
 * Decorator to require specific scopes for an endpoint
 * When used with access tokens, the token must have the required scopes
 * JWT tokens are not affected by this decorator
 * 
 * @param scopes - Array of required scopes
 * 
 * @example
 * ```typescript
 * @RequireScopes([AccessTokenScope.WATCH])
 * @Patch(':id/read')
 * async markAsRead() { }
 * ```
 */
export const RequireScopes = (scopes: AccessTokenScope[]) => {
  return SetMetadata(SCOPES_KEY, scopes);
};

