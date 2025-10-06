import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser } from './builtin-parser.interface';
import {
  CreateMessageDto,
  NotificationAttachmentDto,
} from '../../messages/dto/create-message.dto';
import {
  NotificationDeliveryType,
  MediaType,
} from '../../notifications/notifications.types';

interface ServarrPayload {
  movie?: {
    id: number;
    title: string;
    year: number;
    releaseDate: string;
    folderPath: string;
    tmdbId: number;
    tags: string[];
  };
  series?: {
    id: number;
    title: string;
    titleSlug?: string;
    path?: string;
    year: number;
    folderPath?: string;
    tvdbId: number;
    tvMazeId?: number;
    tmdbId?: number;
    imdbId?: string;
    type?: string;
    genres?: string[];
    images?: Array<{
      coverType: string;
      url: string;
      remoteUrl?: string;
    }>;
    tags: string[];
    originalLanguage?: {
      id: number;
      name: string;
    };
  };
  episodes?: Array<{
    id: number;
    episodeNumber: number;
    seasonNumber: number;
    title: string;
    overview?: string;
    airDate?: string;
    airDateUtc?: string;
    seriesId: number;
    tvdbId: number;
  }>;
  episodeFile?: {
    id: number;
    relativePath: string;
    path: string;
    quality: string;
    qualityVersion: number;
    releaseGroup?: string;
    sceneName?: string;
    size: number;
    dateAdded: string;
    sourcePath?: string;
    languages?: Array<{
      id: number;
      name: string;
    }>;
    mediaInfo?: {
      audioChannels: number;
      audioCodec: string;
      audioLanguages: string[];
      height: number;
      width: number;
      subtitles: string[];
      videoCodec: string;
      videoDynamicRange?: string;
      videoDynamicRangeType?: string;
    };
  };
  remoteMovie?: {
    tmdbId: number;
    imdbId: string;
    title: string;
    year: number;
  };
  release?: {
    quality: string;
    qualityVersion: number;
    releaseGroup: string;
    releaseTitle: string;
    indexer: string;
    size: number;
    customFormatScore: number;
  };
  // Prowlarr specific fields
  indexer?: {
    id: number;
    name: string;
    implementation: string;
    configContract: string;
    enableRss: boolean;
    enableInteractiveSearch: boolean;
    enableAutomaticSearch: boolean;
    priority: number;
    downloadClientId: number;
    protocol: string;
    tags: number[];
  };
  indexerStatus?: {
    id: number;
    name: string;
    status: string;
    lastCheck: string;
    lastError: string;
  };
  eventType: string;
  instanceName: string;
  applicationUrl?: string;
  downloadClient?: string;
  downloadClientType?: string;
  downloadId?: string;
  fileCount?: number;
  sourcePath?: string;
  destinationPath?: string;
  // Health check fields
  level?: string;
  message?: string;
  type?: string;
  wikiUrl?: string;
  // Additional fields from second payload type
  isUpgrade?: boolean;
  customFormatInfo?: {
    customFormats: any[];
    customFormatScore: number;
  };
}

@Injectable()
export class ServarrParser implements IBuiltinParser {
  get builtInType(): PayloadMapperBuiltInType {
    return PayloadMapperBuiltInType.ZENTIK_SERVARR;
  }

  get name(): string {
    return 'Servarr';
  }

  get description(): string {
    return 'Parser for Servarr applications (Radarr, Sonarr, Prowlarr, etc.) - handles movie/TV show download and import events, indexer events, health check notifications, and unknown payloads';
  }

  validate(payload: any): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // Check for required fields
    if (!payload.eventType || !payload.instanceName) {
      return false;
    }

    // Check if it's a movie, TV show event, Prowlarr event, or health check event
    if (
      !payload.movie &&
      !payload.series &&
      !payload.episodes &&
      !payload.indexer &&
      !payload.indexerStatus &&
      !payload.message
    ) {
      return false;
    }

    // If it has episodeFiles (array), reject it - we only want episodeFile (object)
    if (payload.episodeFiles) {
      return false;
    }

    return true;
  }

  parse(payload: ServarrPayload): CreateMessageDto {
    const eventType = this.extractEventType(payload);
    const mediaInfo = this.extractMediaInfo(payload);
    const releaseInfo = this.extractReleaseInfo(payload);
    const attachments = this.extractAttachments(payload);

    // If no media info was extracted, create a fallback for unknown payload
    if (Object.keys(mediaInfo).length === 0) {
      return this.createUnknownPayloadMessage(payload);
    }

    return {
      title: this.getNotificationTitle(
        eventType,
        mediaInfo,
        payload.instanceName,
      ),
      subtitle: this.getNotificationSubtitle(mediaInfo),
      body: this.getNotificationBody(
        eventType,
        mediaInfo,
        releaseInfo,
        payload,
      ),
      deliveryType: this.getEventPriority(eventType),
      bucketId: '', // Will be set by the service
      attachments: attachments.length > 0 ? attachments : undefined,
    };
  }

  private extractEventType(payload: ServarrPayload): string {
    const eventType = payload.eventType?.toLowerCase() || 'unknown';

    // Map common Servarr event types
    switch (eventType) {
      case 'download':
      case 'grabbed':
        return 'download';
      case 'imported':
      case 'import':
        return 'imported';
      case 'failed':
      case 'failure':
        return 'failed';
      case 'deleted':
        return 'deleted';
      case 'renamed':
        return 'renamed';
      case 'healthissue':
        return 'health_issue';
      case 'healthrestored':
        return 'health_restored';
      default:
        return eventType;
    }
  }

  private extractMediaInfo(payload: ServarrPayload): any {
    if (payload.movie) {
      return {
        type: 'movie',
        title: payload.movie.title,
        year: payload.movie.year,
        tmdbId: payload.movie.tmdbId,
        folderPath: payload.movie.folderPath,
        tags: payload.movie.tags || [],
      };
    }

    if (payload.series) {
      return {
        type: 'series',
        title: payload.series.title,
        year: payload.series.year,
        tvdbId: payload.series.tvdbId,
        folderPath: payload.series.folderPath || payload.series.path,
        tags: payload.series.tags || [],
        genres: payload.series.genres || [],
        images: payload.series.images || [],
        episodes: payload.episodes || [],
        episodeFile: payload.episodeFile,
      };
    }

    // Handle payload with episodes but no series info
    if (payload.episodes && payload.episodes.length > 0) {
      const episode = payload.episodes[0]; // Use first episode for series info
      return {
        type: 'series',
        title: 'Unknown Series', // Will be updated if series info is available
        year: 0,
        tvdbId: episode.tvdbId,
        folderPath: '',
        tags: [],
        genres: [],
        images: [],
        episodes: payload.episodes,
        episodeFile: payload.episodeFile,
      };
    }

    // Handle Prowlarr indexer events
    if (payload.indexer) {
      return {
        type: 'indexer',
        title: payload.indexer.name,
        implementation: payload.indexer.implementation,
        protocol: payload.indexer.protocol,
        priority: payload.indexer.priority,
        tags: payload.indexer.tags || [],
      };
    }

    // Handle Prowlarr indexer status events
    if (payload.indexerStatus) {
      return {
        type: 'indexerStatus',
        title: payload.indexerStatus.name,
        status: payload.indexerStatus.status,
        lastCheck: payload.indexerStatus.lastCheck,
        lastError: payload.indexerStatus.lastError,
      };
    }

    // Handle health check events
    if (payload.message && payload.level && payload.type) {
      return {
        type: 'health',
        title: payload.type,
        level: payload.level,
        message: payload.message,
        wikiUrl: payload.wikiUrl,
        checkType: payload.type,
      };
    }

    return {};
  }

  private extractReleaseInfo(payload: ServarrPayload): any {
    if (!payload.release) {
      return {};
    }

    return {
      quality: payload.release.quality,
      releaseGroup: payload.release.releaseGroup,
      releaseTitle: payload.release.releaseTitle,
      indexer: payload.release.indexer,
      size: this.formatFileSize(payload.release.size),
      customFormatScore: payload.release.customFormatScore,
    };
  }

  private extractAttachments(
    payload: ServarrPayload,
  ): NotificationAttachmentDto[] {
    const attachments: NotificationAttachmentDto[] = [];

    // Extract image from series
    if (
      payload.series &&
      payload.series.images &&
      payload.series.images.length > 0
    ) {
      // First try to find a banner image
      let selectedImage = payload.series.images.find(
        (img) => img.coverType === 'banner',
      );

      // If no banner found, use the first available image
      if (!selectedImage) {
        selectedImage = payload.series.images[0];
      }

      if (selectedImage) {
        // Always use remoteUrl if available, otherwise fall back to url
        let imageUrl = selectedImage.remoteUrl || selectedImage.url;

        // If still a relative URL and we have applicationUrl, make it absolute
        if (imageUrl && imageUrl.startsWith('/') && payload.applicationUrl) {
          const baseUrl = payload.applicationUrl.replace(/\/$/, '');
          imageUrl = `${baseUrl}${imageUrl}`;
        }

        if (imageUrl) {
          const imageType =
            selectedImage.coverType === 'banner'
              ? 'Banner'
              : selectedImage.coverType === 'poster'
                ? 'Poster'
                : selectedImage.coverType === 'fanart'
                  ? 'Fanart'
                  : 'Image';

          attachments.push({
            url: imageUrl,
            mediaType: MediaType.IMAGE,
            name: `${payload.series.title} ${imageType}`,
            saveOnServer: false,
          });
        }
      }
    }

    return attachments;
  }

  private getNotificationTitle(
    eventType: string,
    mediaInfo: any,
    instanceName: string,
  ): string {
    const eventName = this.capitalizeFirst(eventType);

    // Handle health events
    if (mediaInfo.type === 'health') {
      const levelIcon = this.getHealthLevelIcon(mediaInfo.level);
      return `${levelIcon} ${instanceName} Health ${eventName}`;
    }

    let mediaTitle = mediaInfo.title || 'Unknown';

    // For series with episodes, create a more comprehensive title
    if (
      mediaInfo.type === 'series' &&
      mediaInfo.episodes &&
      mediaInfo.episodes.length > 0
    ) {
      const episode = mediaInfo.episodes[0];
      const seriesTitle =
        mediaInfo.title !== 'Unknown Series' ? mediaInfo.title : null;

      if (episode.seasonNumber && episode.episodeNumber) {
        const episodeCode = `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;
        if (episode.title && seriesTitle) {
          mediaTitle = `${seriesTitle} ${episodeCode} - ${episode.title}`;
        } else if (episode.title && !seriesTitle) {
          // If no series title, just use episode title
          mediaTitle = episode.title;
        } else if (seriesTitle) {
          mediaTitle = `${seriesTitle} ${episodeCode}`;
        } else {
          // No series title, just episode code
          mediaTitle = episodeCode;
        }
      } else if (episode.title) {
        if (seriesTitle) {
          mediaTitle = `${seriesTitle} - ${episode.title}`;
        } else {
          mediaTitle = episode.title;
        }
      }
    }

    const year =
      mediaInfo.year && mediaInfo.year > 0 ? ` (${mediaInfo.year})` : '';

    return `${eventName}: ${mediaTitle}${year}`;
  }

  private getNotificationSubtitle(mediaInfo: any): string {
    if (mediaInfo.type === 'movie') {
      return `Movie via Radarr`;
    } else if (mediaInfo.type === 'series') {
      return `TV Show via Sonarr`;
    } else if (
      mediaInfo.type === 'indexer' ||
      mediaInfo.type === 'indexerStatus'
    ) {
      return `Indexer via Prowlarr`;
    } else if (mediaInfo.type === 'health') {
      return `System Health Check`;
    }
    return 'Servarr';
  }

  private getNotificationBody(
    eventType: string,
    mediaInfo: any,
    releaseInfo: any,
    payload: ServarrPayload,
  ): string {
    let message = '';

    // Handle health events
    if (mediaInfo.type === 'health') {
      message += `${mediaInfo.message}`;

      if (mediaInfo.checkType) {
        message += `\nCheck Type: ${mediaInfo.checkType}`;
      }

      if (mediaInfo.level) {
        message += `\nLevel: ${this.capitalizeFirst(mediaInfo.level)}`;
      }

      if (mediaInfo.wikiUrl) {
        message += `\nMore Info: ${mediaInfo.wikiUrl}`;
      }

      if (payload.instanceName) {
        message += `\nInstance: ${payload.instanceName}`;
      }

      return message;
    }

    // Add media information
    if (mediaInfo.title && mediaInfo.title !== 'Unknown Series') {
      message += `${mediaInfo.title}`;
      if (mediaInfo.year && mediaInfo.year > 0) {
        message += ` (${mediaInfo.year})`;
      }
    }

    // Add episode information if available
    if (mediaInfo.episodes && mediaInfo.episodes.length > 0) {
      const episode = mediaInfo.episodes[0];

      // Add season and episode numbers
      if (episode.seasonNumber && episode.episodeNumber) {
        message += `\nSeason: ${episode.seasonNumber}`;
        message += `\nEpisode: ${episode.episodeNumber}`;
      }

      // Add episode title
      if (episode.title) {
        message += `\nTitle: ${episode.title}`;
      }

      // Add episode overview if available
      if (episode.overview && episode.overview.length > 0) {
        // Truncate overview if too long
        const overview =
          episode.overview.length > 200
            ? `${episode.overview.substring(0, 200)}...`
            : episode.overview;
        message += `\nOverview: ${overview}`;
      }

      // Add air date if available
      if (episode.airDate) {
        message += `\nAir Date: ${episode.airDate}`;
      }
    }

    // Add release information for download/import events
    if (['download', 'imported'].includes(eventType) && releaseInfo.quality) {
      message += `\nQuality: ${releaseInfo.quality}`;

      if (releaseInfo.releaseGroup) {
        message += `\nGroup: ${releaseInfo.releaseGroup}`;
      }

      if (releaseInfo.indexer) {
        message += `\nIndexer: ${releaseInfo.indexer}`;
      }

      if (releaseInfo.size) {
        message += `\nSize: ${releaseInfo.size}`;
      }
    }

    // Add folder path for import events
    if (eventType === 'imported' && mediaInfo.folderPath) {
      message += `\nPath: ${mediaInfo.folderPath}`;
    }

    // Add episode file information if available
    if (mediaInfo.episodeFile) {
      const episodeFile = mediaInfo.episodeFile;
      if (episodeFile.quality && !releaseInfo.quality) {
        message += `\nQuality: ${episodeFile.quality}`;
      }
      if (episodeFile.releaseGroup && !releaseInfo.releaseGroup) {
        message += `\nGroup: ${episodeFile.releaseGroup}`;
      }
      if (episodeFile.size) {
        message += `\nSize: ${this.formatFileSize(episodeFile.size)}`;
      }
      if (episodeFile.languages && episodeFile.languages.length > 0) {
        const languages = episodeFile.languages
          .map((lang) => lang.name)
          .join(', ');
        message += `\nLanguages: ${languages}`;
      }
    }

    // Add genres if available
    if (mediaInfo.genres && mediaInfo.genres.length > 0) {
      message += `\nGenres: ${mediaInfo.genres.join(', ')}`;
    }

    // Add tags if available
    if (mediaInfo.tags && mediaInfo.tags.length > 0) {
      message += `\nTags: ${mediaInfo.tags.join(', ')}`;
    }

    // Add Prowlarr specific information
    if (mediaInfo.type === 'indexer') {
      if (mediaInfo.implementation) {
        message += `\nImplementation: ${mediaInfo.implementation}`;
      }
      if (mediaInfo.protocol) {
        message += `\nProtocol: ${mediaInfo.protocol}`;
      }
      if (mediaInfo.priority !== undefined) {
        message += `\nPriority: ${mediaInfo.priority}`;
      }
    }

    if (mediaInfo.type === 'indexerStatus') {
      if (mediaInfo.status) {
        message += `\nStatus: ${mediaInfo.status}`;
      }
      if (mediaInfo.lastCheck) {
        message += `\nLast Check: ${mediaInfo.lastCheck}`;
      }
      if (mediaInfo.lastError) {
        message += `\nLast Error: ${mediaInfo.lastError}`;
      }
    }

    // Add upgrade information if available
    if (payload.isUpgrade !== undefined) {
      message += `\nUpgrade: ${payload.isUpgrade ? 'Yes' : 'No'}`;
    }

    // Add custom format information if available
    if (
      payload.customFormatInfo &&
      payload.customFormatInfo.customFormatScore !== undefined
    ) {
      message += `\nCustom Format Score: ${payload.customFormatInfo.customFormatScore}`;
    }

    // Add instance name
    if (payload.instanceName) {
      message += `\nInstance: ${payload.instanceName}`;
    }

    // Add fallback information for unknown events
    if (this.isUnknownEvent(eventType)) {
      message += `\nEvent Type: ${payload.eventType}`;
      if (payload.applicationUrl) {
        message += `\nApplication: ${payload.applicationUrl}`;
      }
    }

    return message;
  }

  private getEventPriority(eventType: string): NotificationDeliveryType {
    switch (eventType) {
      case 'failed':
      case 'failure':
        return NotificationDeliveryType.CRITICAL;
      case 'health_issue':
        return NotificationDeliveryType.CRITICAL;
      case 'health_restored':
        return NotificationDeliveryType.NORMAL;
      case 'imported':
      case 'import':
        return NotificationDeliveryType.NORMAL;
      case 'download':
      case 'grabbed':
        return NotificationDeliveryType.NORMAL;
      default:
        return NotificationDeliveryType.NORMAL;
    }
  }

  private getHealthLevelIcon(level: string): string {
    switch (level?.toLowerCase()) {
      case 'error':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🔵';
      default:
        return '⚪';
    }
  }

  private createUnknownPayloadMessage(
    payload: ServarrPayload,
  ): CreateMessageDto {
    const instanceName = payload.instanceName || 'Unknown Instance';

    let body = 'Unknown payload received from Servarr application.';

    if (payload.eventType) {
      body += `\nEvent Type: ${payload.eventType}`;
    }

    if (payload.instanceName) {
      body += `\nInstance: ${payload.instanceName}`;
    }

    // Add any additional fields that might be useful
    if (payload.message) {
      body += `\nMessage: ${payload.message}`;
    }

    if (payload.level) {
      body += `\nLevel: ${payload.level}`;
    }

    if (payload.type) {
      body += `\nType: ${payload.type}`;
    }

    // Add raw payload for debugging (truncated)
    const payloadStr = JSON.stringify(payload, null, 2);
    const truncatedPayload =
      payloadStr.length > 500
        ? `${payloadStr.substring(0, 500)}...`
        : payloadStr;
    body += `\n\nRaw Payload:\n${truncatedPayload}`;

    return {
      title: `❓ Unknown payload: ${instanceName}`,
      subtitle: `Unknown Event from ${instanceName}`,
      body: body,
      deliveryType: NotificationDeliveryType.NORMAL,
      bucketId: '', // Will be set by the service
    };
  }

  private formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private isUnknownEvent(eventType: string): boolean {
    const knownEvents = [
      'download',
      'grabbed',
      'imported',
      'import',
      'failed',
      'failure',
      'deleted',
      'renamed',
      'health_issue',
      'health_restored',
      'healthissue',
      'healthrestored',
    ];
    return !knownEvents.includes(eventType.toLowerCase());
  }
}
