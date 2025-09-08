import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

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
    year: number;
    folderPath: string;
    tvdbId: number;
    tags: string[];
  };
  episodes?: Array<{
    id: number;
    episodeNumber: number;
    seasonNumber: number;
    title: string;
    seriesId: number;
    tvdbId: number;
  }>;
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
}

@Injectable()
export class ServarrParser implements IBuiltinParser {
  get builtInType(): PayloadMapperBuiltInType {
    return PayloadMapperBuiltInType.ZentikServarr;
  }

  get name(): string {
    return 'Servarr';
  }

  get description(): string {
    return 'Parser for Servarr applications (Radarr, Sonarr, Prowlarr, etc.) - handles movie/TV show download and import events, and indexer events';
  }

  validate(payload: any): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // Check for required fields
    if (!payload.eventType || !payload.instanceName) {
      return false;
    }

    // Check if it's a movie, TV show event, or Prowlarr event
    if (!payload.movie && !payload.series && !payload.episodes && !payload.indexer && !payload.indexerStatus) {
      return false;
    }

    return true;
  }

  parse(payload: ServarrPayload): CreateMessageDto {
    const eventType = this.extractEventType(payload);
    const mediaInfo = this.extractMediaInfo(payload);
    const releaseInfo = this.extractReleaseInfo(payload);

    return {
      title: this.getNotificationTitle(eventType, mediaInfo, payload.instanceName),
      subtitle: this.getNotificationSubtitle(mediaInfo),
      body: this.getNotificationBody(eventType, mediaInfo, releaseInfo, payload),
      deliveryType: this.getEventPriority(eventType),
      bucketId: '', // Will be set by the service
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
        folderPath: payload.series.folderPath,
        tags: payload.series.tags || [],
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
        episodes: payload.episodes,
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

  private getNotificationTitle(eventType: string, mediaInfo: any, instanceName: string): string {
    const eventName = this.capitalizeFirst(eventType);
    let mediaTitle = mediaInfo.title || 'Unknown';
    
    // Handle episodes-only payloads
    if (mediaInfo.episodes && mediaInfo.episodes.length > 0 && mediaTitle === 'Unknown Series') {
      const episode = mediaInfo.episodes[0];
      if (episode.title) {
        mediaTitle = episode.title;
      } else if (episode.seasonNumber && episode.episodeNumber) {
        mediaTitle = `S${episode.seasonNumber}E${episode.episodeNumber}`;
      }
    }
    
    const year = mediaInfo.year && mediaInfo.year > 0 ? ` (${mediaInfo.year})` : '';
    
    return `${eventName}: ${mediaTitle}${year}`;
  }

  private getNotificationSubtitle(mediaInfo: any): string {
    if (mediaInfo.type === 'movie') {
      return `Movie via Radarr`;
    } else if (mediaInfo.type === 'series') {
      return `TV Show via Sonarr`;
    } else if (mediaInfo.type === 'indexer' || mediaInfo.type === 'indexerStatus') {
      return `Indexer via Prowlarr`;
    }
    return 'Servarr';
  }

  private getNotificationBody(eventType: string, mediaInfo: any, releaseInfo: any, payload: ServarrPayload): string {
    let message = '';

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
      if (episode.title) {
        message += `\nEpisode: ${episode.title}`;
      }
      if (episode.seasonNumber && episode.episodeNumber) {
        message += `\nSeason ${episode.seasonNumber}, Episode ${episode.episodeNumber}`;
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

  private getEventIcon(eventType: string): string {
    switch (eventType) {
      case 'download':
      case 'grabbed':
        return '⬇️';
      case 'imported':
      case 'import':
        return '✅';
      case 'failed':
      case 'failure':
        return '❌';
      case 'deleted':
        return '🗑️';
      case 'renamed':
        return '📝';
      default:
        return '🎬';
    }
  }

  private getEventColor(eventType: string): string {
    switch (eventType) {
      case 'download':
      case 'grabbed':
        return '#2196F3'; // Blue
      case 'imported':
      case 'import':
        return '#4CAF50'; // Green
      case 'failed':
      case 'failure':
        return '#F44336'; // Red
      case 'deleted':
        return '#FF9800'; // Orange
      case 'renamed':
        return '#9C27B0'; // Purple
      default:
        return '#607D8B'; // Blue Grey
    }
  }

  private getEventPriority(eventType: string): NotificationDeliveryType {
    switch (eventType) {
      case 'failed':
      case 'failure':
        return NotificationDeliveryType.CRITICAL;
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
    const knownEvents = ['download', 'grabbed', 'imported', 'import', 'failed', 'failure', 'deleted', 'renamed'];
    return !knownEvents.includes(eventType.toLowerCase());
  }
}
