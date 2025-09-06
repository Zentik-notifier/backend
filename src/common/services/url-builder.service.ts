import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UrlBuilderService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Builds a complete URL for a given endpoint path
   * @param endpointPath - The endpoint path (e.g., '/auth/provider/callback', '/attachments/123')
   * @returns Complete URL with base URL and API prefix
   */
  buildUrl(endpointPath: string): string {
    const baseUrl = (
      this.configService.get<string>('PUBLIC_BACKEND_URL') ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const apiPrefix =
      this.configService.get<string>('BACKEND_API_PREFIX') || '/api/v1';

    // Normalize API prefix to start with one / and no trailing /
    const normalizedPrefix = `/${apiPrefix}`
      .replace(/\/+/, '/')
      .replace(/\/$/, '');

    // Ensure endpointPath starts with /
    const normalizedPath = endpointPath.startsWith('/')
      ? endpointPath
      : `/${endpointPath}`;

    // Avoid double prefix if endpointPath already includes the prefix
    const pathWithoutBase = normalizedPath.startsWith(normalizedPrefix)
      ? normalizedPath
      : `${normalizedPrefix}${normalizedPath}`;

    return `${baseUrl}${pathWithoutBase}`;
  }

  /**
   * Builds a callback URL for OAuth providers
   * @param providerId - The OAuth provider ID
   * @param customCallbackUrl - Optional custom callback URL
   * @returns Complete callback URL
   */
  buildOAuthCallbackUrl(
    providerId: string,
    customCallbackUrl?: string,
  ): string {
    if (customCallbackUrl) {
      return customCallbackUrl;
    }

    return this.buildUrl(`/auth/${providerId}/callback`);
  }

  /**
   * Gets the base URL from configuration
   * @returns Base URL
   */
  getBaseUrl(): string {
    return (
      this.configService.get<string>('PUBLIC_BACKEND_URL') ||
      'http://localhost:3000'
    );
  }

  /**
   * Gets the API prefix from configuration
   * @returns API prefix
   */
  getApiPrefix(): string {
    return this.configService.get<string>('BACKEND_API_PREFIX') || '/api/v1';
  }

  /**
   * Builds a public download URL for an attachment
   * @param attachmentId - The attachment UUID
   * @returns Complete public download URL
   */
  buildAttachmentUrl(attachmentId: string): string {
    return this.buildUrl(`/attachments/${attachmentId}/download/public`);
  }

  /**
   * Builds a thumbnail URL for an attachment
   * @param attachmentId - The attachment UUID
   * @param size - The thumbnail size (e.g., 'small', 'medium', 'large')
   * @returns Complete thumbnail URL
   */
  buildThumbnailUrl(attachmentId: string, size: string = 'medium'): string {
    return this.buildUrl(`/attachments/${attachmentId}/thumbnail?size=${size}`);
  }

  /**
   * Mutates notifications/messages attachments in-place to ensure each attachment has a valid url
   * If attachment.url is missing and attachmentUuid is present, builds a public download URL.
   */
  processNotifications<
    T extends {
      message?: {
        attachments?: Array<{
          attachmentUuid?: string | null;
          url?: string | null;
        }>;
      };
    },
  >(notifications: T[]): T[] {
    return notifications.map((notification) => {
      if (
        notification?.message?.attachments &&
        Array.isArray(notification.message.attachments)
      ) {
        notification.message.attachments = notification.message.attachments.map(
          (att) => {
            if (att && !att.url && att.attachmentUuid) {
              return {
                ...att,
                url: this.buildAttachmentUrl(att.attachmentUuid),
              } as any;
            }
            return att as any;
          },
        );
      }
      return notification;
    });
  }
}
