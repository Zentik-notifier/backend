import { Test, TestingModule } from '@nestjs/testing';
import { ServarrParser } from './servarr.parser';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

describe('ServarrParser', () => {
  let parser: ServarrParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServarrParser],
    }).compile();

    parser = module.get<ServarrParser>(ServarrParser);
  });

  it('should be defined', () => {
    expect(parser).toBeDefined();
  });

  describe('builtInType', () => {
    it('should return ZENTIK_SERVARR', () => {
      expect(parser.builtInType).toBe('ZENTIK_SERVARR');
    });
  });

  describe('name', () => {
    it('should return Servarr', () => {
      expect(parser.name).toBe('Servarr');
    });
  });

  describe('description', () => {
    it('should return correct description', () => {
      expect(parser.description).toBe(
        'Parser for Servarr applications (Radarr, Sonarr, Prowlarr, etc.) - handles movie/TV show download and import events, indexer events, health check notifications, and unknown payloads',
      );
    });
  });

  describe('validate', () => {
    it('should return true for valid movie payload', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Radarr',
        movie: {
          id: 1,
          title: 'Test Movie',
          year: 2023,
          releaseDate: '2023-01-01',
          folderPath: '/movies/Test Movie',
          tmdbId: 12345,
          tags: ['action', 'thriller'],
        },
      };

      expect(parser.validate(payload)).toBe(true);
    });

    it('should return true for valid series payload', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Sonarr',
        series: {
          id: 1,
          title: 'Test Series',
          year: 2023,
          folderPath: '/tv/Test Series',
          tvdbId: 12345,
          tags: ['drama', 'comedy'],
        },
      };

      expect(parser.validate(payload)).toBe(true);
    });

    it('should return false for payload without eventType', () => {
      const payload = {
        instanceName: 'Radarr',
        movie: {
          id: 1,
          title: 'Test Movie',
          year: 2023,
        },
      };

      expect(parser.validate(payload)).toBe(false);
    });

    it('should return false for payload without instanceName', () => {
      const payload = {
        eventType: 'Download',
        movie: {
          id: 1,
          title: 'Test Movie',
          year: 2023,
        },
      };

      expect(parser.validate(payload)).toBe(false);
    });

    it('should return false for payload without movie or series', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Radarr',
      };

      expect(parser.validate(payload)).toBe(false);
    });

    it('should return true for Prowlarr indexer payload', () => {
      const payload = {
        eventType: 'IndexerAdded',
        instanceName: 'Prowlarr',
        indexer: {
          id: 1,
          name: 'Test Indexer',
          implementation: 'Newznab',
        },
      };

      expect(parser.validate(payload)).toBe(true);
    });

    it('should return true for Prowlarr indexer status payload', () => {
      const payload = {
        eventType: 'IndexerStatusChanged',
        instanceName: 'Prowlarr',
        indexerStatus: {
          id: 1,
          name: 'Test Indexer',
          status: 'Healthy',
        },
      };

      expect(parser.validate(payload)).toBe(true);
    });

    it('should return false for empty payload', () => {
      expect(parser.validate({})).toBe(false);
    });

    it('should return false for null payload', () => {
      expect(parser.validate(null)).toBe(false);
    });

    it('should return true for health check payload', () => {
      const payload = {
        level: 'warning',
        message:
          'Applications unavailable due to failures for more than 6 hours: Readarr',
        type: 'ApplicationLongTermStatusCheck',
        eventType: 'HealthRestored',
        instanceName: 'Prowlarr',
      };
      expect(parser.validate(payload)).toBe(true);
    });

    it('should return false for payload with episodeFiles array', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Sonarr',
        series: {
          id: 1,
          title: 'Test Series',
          tvdbId: 123,
          tags: [],
          year: 2023,
        },
        episodes: [
          {
            id: 1,
            title: 'Test Episode',
            episodeNumber: 1,
            seasonNumber: 1,
            seriesId: 1,
            tvdbId: 123,
          },
        ],
        episodeFiles: [{ id: 1, path: '/test/path' }], // This should be rejected
      };
      expect(parser.validate(payload)).toBe(false);
    });

    it('should return true for payload with episodeFile object', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Sonarr',
        series: {
          id: 1,
          title: 'Test Series',
          tvdbId: 123,
          tags: [],
          year: 2023,
        },
        episodes: [
          {
            id: 1,
            title: 'Test Episode',
            episodeNumber: 1,
            seasonNumber: 1,
            seriesId: 1,
            tvdbId: 123,
          },
        ],
        episodeFile: {
          id: 1,
          path: '/test/path',
          quality: 'HD',
          size: 1000,
          dateAdded: '2023-01-01',
        }, // This should be accepted
      };
      expect(parser.validate(payload)).toBe(true);
    });
  });

  describe('parse', () => {
    const mockMoviePayload = {
      eventType: 'Download',
      instanceName: 'Radarr',
      applicationUrl: 'http://radarr.local',
      movie: {
        id: 1,
        title: 'Test Movie',
        year: 2023,
        releaseDate: '2023-01-01',
        folderPath: '/movies/Test Movie',
        tmdbId: 12345,
        tags: ['action', 'thriller'],
      },
      release: {
        quality: 'Bluray-1080p',
        qualityVersion: 1,
        releaseGroup: 'RARBG',
        releaseTitle: 'Test.Movie.2023.1080p.BluRay.x264-RARBG',
        indexer: 'RARBG',
        size: 8589934592, // 8GB
        customFormatScore: 0,
      },
    };

    it('should parse download event correctly', () => {
      const result = parser.parse(mockMoviePayload);

      expect(result.title).toBe('Download: Test Movie (2023)');
      expect(result.subtitle).toBe('Movie via Radarr');
      expect(result.body).toContain('Test Movie (2023)');
      expect(result.body).toContain('Quality: Bluray-1080p');
      expect(result.body).toContain('Group: RARBG');
      expect(result.body).toContain('Indexer: RARBG');
      expect(result.body).toContain('Size: 8 GB');
      expect(result.body).toContain('Tags: action, thriller');
      expect(result.body).toContain('Instance: Radarr');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse imported event correctly', () => {
      const payload = { ...mockMoviePayload, eventType: 'Imported' };
      const result = parser.parse(payload);

      expect(result.title).toBe('Imported: Test Movie (2023)');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
      expect(result.body).toContain('Path: /movies/Test Movie');
    });

    it('should parse failed event correctly', () => {
      const payload = { ...mockMoviePayload, eventType: 'Failed' };
      const result = parser.parse(payload);

      expect(result.title).toBe('Failed: Test Movie (2023)');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse deleted event correctly', () => {
      const payload = { ...mockMoviePayload, eventType: 'Deleted' };
      const result = parser.parse(payload);

      expect(result.title).toBe('Deleted: Test Movie (2023)');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse renamed event correctly', () => {
      const payload = { ...mockMoviePayload, eventType: 'Renamed' };
      const result = parser.parse(payload);

      expect(result.title).toBe('Renamed: Test Movie (2023)');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle unknown event type', () => {
      const payload = { ...mockMoviePayload, eventType: 'UnknownEvent' };
      const result = parser.parse(payload);

      expect(result.title).toBe('Unknownevent: Test Movie (2023)');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle payload without release info', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Radarr',
        applicationUrl: 'http://radarr.local',
        movie: {
          id: 1,
          title: 'Test Movie',
          year: 2023,
          releaseDate: '2023-01-01',
          folderPath: '/movies/Test Movie',
          tmdbId: 12345,
          tags: [],
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Download: Test Movie (2023)');
      expect(result.body).toBe('Test Movie (2023)\nInstance: Radarr');
    });

    it('should handle payload without tags', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Radarr',
        applicationUrl: 'http://radarr.local',
        movie: {
          id: 1,
          title: 'Test Movie',
          year: 2023,
          releaseDate: '2023-01-01',
          folderPath: '/movies/Test Movie',
          tmdbId: 12345,
          tags: [],
        },
      };

      const result = parser.parse(payload);

      expect(result.body).not.toContain('Tags:');
    });

    it('should format file size correctly', () => {
      const payload = {
        ...mockMoviePayload,
        release: {
          ...mockMoviePayload.release,
          size: 1073741824, // 1GB
        },
      };

      const result = parser.parse(payload);

      expect(result.body).toContain('Size: 1 GB');
    });

    it('should handle series payload', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Sonarr',
        applicationUrl: 'http://sonarr.local',
        series: {
          id: 1,
          title: 'Test Series',
          year: 2023,
          folderPath: '/tv/Test Series',
          tvdbId: 12345,
          tags: ['drama'],
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Download: Test Series (2023)');
      expect(result.subtitle).toBe('TV Show via Sonarr');
    });

    it('should handle episodes-only payload', () => {
      const payload = {
        eventType: 'Test',
        instanceName: 'Sonarr',
        applicationUrl: 'http://sonarr.local',
        episodes: [
          {
            id: 123,
            episodeNumber: 1,
            seasonNumber: 1,
            title: 'Test title',
            seriesId: 0,
            tvdbId: 0,
          },
        ],
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Test: Test title');
      expect(result.subtitle).toBe('TV Show via Sonarr');
      expect(result.body).toContain('Season: 1');
      expect(result.body).toContain('Episode: 1');
      expect(result.body).toContain('Title: Test title');
      expect(result.body).toContain('Instance: Sonarr');
    });

    it('should handle episodes payload without episode title', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Sonarr',
        applicationUrl: 'http://sonarr.local',
        episodes: [
          {
            id: 123,
            episodeNumber: 5,
            seasonNumber: 2,
            title: '',
            seriesId: 0,
            tvdbId: 0,
          },
        ],
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Download: S02E05');
      expect(result.subtitle).toBe('TV Show via Sonarr');
      expect(result.body).toContain('Season: 2');
      expect(result.body).toContain('Episode: 5');
    });

    it('should handle unknown event types with fallback', () => {
      const payload = {
        eventType: 'CustomEvent',
        instanceName: 'Radarr',
        applicationUrl: 'http://radarr.local',
        movie: {
          id: 1,
          title: 'Test Movie',
          year: 2023,
          releaseDate: '2023-01-01',
          folderPath: '/movies/Test Movie',
          tmdbId: 12345,
          tags: ['action'],
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Customevent: Test Movie (2023)');
      expect(result.subtitle).toBe('Movie via Radarr');
      expect(result.body).toContain('Test Movie (2023)');
      expect(result.body).toContain('Event Type: CustomEvent');
      expect(result.body).toContain('Application: http://radarr.local');
      expect(result.body).toContain('Instance: Radarr');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle unknown event types for series with fallback', () => {
      const payload = {
        eventType: 'SeriesCustomEvent',
        instanceName: 'Sonarr',
        applicationUrl: 'http://sonarr.local',
        series: {
          id: 1,
          title: 'Test Series',
          year: 2023,
          folderPath: '/tv/Test Series',
          tvdbId: 12345,
          tags: ['drama'],
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Seriescustomevent: Test Series (2023)');
      expect(result.subtitle).toBe('TV Show via Sonarr');
      expect(result.body).toContain('Test Series (2023)');
      expect(result.body).toContain('Event Type: SeriesCustomEvent');
      expect(result.body).toContain('Application: http://sonarr.local');
      expect(result.body).toContain('Instance: Sonarr');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle Prowlarr indexer events', () => {
      const payload = {
        eventType: 'IndexerAdded',
        instanceName: 'Prowlarr',
        applicationUrl: 'http://prowlarr.local',
        indexer: {
          id: 1,
          name: 'Test Indexer',
          implementation: 'Newznab',
          configContract: 'NewznabSettings',
          enableRss: true,
          enableInteractiveSearch: true,
          enableAutomaticSearch: true,
          priority: 25,
          downloadClientId: 0,
          protocol: 'usenet',
          tags: [1, 2],
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Indexeradded: Test Indexer');
      expect(result.subtitle).toBe('Indexer via Prowlarr');
      expect(result.body).toContain('Test Indexer');
      expect(result.body).toContain('Implementation: Newznab');
      expect(result.body).toContain('Protocol: usenet');
      expect(result.body).toContain('Priority: 25');
      expect(result.body).toContain('Instance: Prowlarr');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle Prowlarr indexer status events', () => {
      const payload = {
        eventType: 'IndexerStatusChanged',
        instanceName: 'Prowlarr',
        applicationUrl: 'http://prowlarr.local',
        indexerStatus: {
          id: 1,
          name: 'Test Indexer',
          status: 'Healthy',
          lastCheck: '2023-01-01T12:00:00Z',
          lastError: '',
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Indexerstatuschanged: Test Indexer');
      expect(result.subtitle).toBe('Indexer via Prowlarr');
      expect(result.body).toContain('Test Indexer');
      expect(result.body).toContain('Status: Healthy');
      expect(result.body).toContain('Last Check: 2023-01-01T12:00:00Z');
      expect(result.body).toContain('Instance: Prowlarr');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle minimal Prowlarr payload', () => {
      const payload = {
        eventType: 'Test',
        instanceName: 'Prowlarr',
        applicationUrl: '',
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('❓ Unknown payload: Prowlarr');
      expect(result.subtitle).toBe('Unknown Event from Prowlarr');
      expect(result.body).toContain('Instance: Prowlarr');
      expect(result.body).toContain('Event Type: Test');
      expect(result.body).toContain(
        'Unknown payload received from Servarr application',
      );
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle health check warning payload', () => {
      const payload = {
        level: 'warning',
        message:
          'Applications unavailable due to failures for more than 6 hours: Readarr',
        type: 'ApplicationLongTermStatusCheck',
        wikiUrl:
          'https://wiki.servarr.com/prowlarr/system#applications-are-unavailable-due-to-failures',
        eventType: 'HealthRestored',
        instanceName: 'Prowlarr',
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('🟡 Prowlarr Health Health_restored');
      expect(result.subtitle).toBe('System Health Check');
      expect(result.body).toContain(
        'Applications unavailable due to failures for more than 6 hours: Readarr',
      );
      expect(result.body).toContain(
        'Check Type: ApplicationLongTermStatusCheck',
      );
      expect(result.body).toContain('Level: Warning');
      expect(result.body).toContain(
        'More Info: https://wiki.servarr.com/prowlarr/system#applications-are-unavailable-due-to-failures',
      );
      expect(result.body).toContain('Instance: Prowlarr');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should handle health check error payload', () => {
      const payload = {
        level: 'error',
        message: 'All notifications are unavailable due to failures',
        type: 'NotificationStatusCheck',
        wikiUrl:
          'https://wiki.servarr.com/radarr/system#notifications-are-unavailable-due-to-failures',
        eventType: 'HealthIssue',
        instanceName: 'Radarr',
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('🔴 Radarr Health Health_issue');
      expect(result.subtitle).toBe('System Health Check');
      expect(result.body).toContain(
        'All notifications are unavailable due to failures',
      );
      expect(result.body).toContain('Check Type: NotificationStatusCheck');
      expect(result.body).toContain('Level: Error');
      expect(result.body).toContain(
        'More Info: https://wiki.servarr.com/radarr/system#notifications-are-unavailable-due-to-failures',
      );
      expect(result.body).toContain('Instance: Radarr');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should handle payload with episodeFile object and upgrade info', () => {
      const payload = {
        eventType: 'Download',
        instanceName: 'Sonarr',
        series: {
          id: 24,
          title: 'The O.C.',
          year: 2003,
          tvdbId: 72164,
          tags: [],
          genres: ['Drama', 'Romance'],
        },
        episodes: [
          {
            id: 3648,
            episodeNumber: 16,
            seasonNumber: 1,
            title: 'The Links',
            overview:
              "He says he's a friend. But who can believe a word Oliver says?",
            seriesId: 24,
            tvdbId: 75558,
          },
        ],
        episodeFile: {
          id: 23127,
          relativePath: 'Season 1/test.mkv',
          path: '/tv/The O.C/Season 1/test.mkv',
          quality: 'WEBDL-1080p',
          qualityVersion: 1,
          releaseGroup: 'Kitsune',
          size: 3254719143,
          dateAdded: '2025-09-17T19:27:16.8811992Z',
          languages: [{ id: 1, name: 'English' }],
        },
        isUpgrade: false,
        customFormatInfo: {
          customFormats: [],
          customFormatScore: 0,
        },
      };

      const result = parser.parse(payload);

      expect(result.title).toBe('Download: The O.C. S01E16 - The Links (2003)');
      expect(result.subtitle).toBe('TV Show via Sonarr');
      expect(result.body).toContain('The O.C. (2003)');
      expect(result.body).toContain('Season: 1');
      expect(result.body).toContain('Episode: 16');
      expect(result.body).toContain('Title: The Links');
      expect(result.body).toContain("Overview: He says he's a friend");
      expect(result.body).toContain('Quality: WEBDL-1080p');
      expect(result.body).toContain('Group: Kitsune');
      expect(result.body).toContain('Size: 3.03 GB');
      expect(result.body).toContain('Languages: English');
      expect(result.body).toContain('Upgrade: No');
      expect(result.body).toContain('Custom Format Score: 0');
      expect(result.body).toContain('Genres: Drama, Romance');
      expect(result.body).toContain('Instance: Sonarr');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });
});
