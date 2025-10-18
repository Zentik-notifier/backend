import { ExpoParser } from './expo.parser';
import { NotificationDeliveryType } from '../../notifications/notifications.types';
import { UserSettingType } from '../../entities/user-setting.types';
import { UsersService } from '../../users/users.service';

// Mock UsersService
const mockUsersService = {
  getUserSettings: jest.fn(),
} as any;

describe('ExpoParser', () => {
  let parser: ExpoParser;

  beforeEach(() => {
    parser = new ExpoParser(mockUsersService);
  });

  it('should be defined', () => {
    expect(parser).toBeDefined();
  });

  describe('builtInType', () => {
    it('should return ZENTIK_EXPO', () => {
      expect(parser.builtInType).toBe('ZENTIK_EXPO');
    });
  });

  describe('name', () => {
    it('should return Expo', () => {
      expect(parser.name).toBe('Expo');
    });
  });

  describe('description', () => {
    it('should return correct description', () => {
      expect(parser.description).toBe(
        'Parser for Expo Application Services (EAS) webhooks - handles build and submit events',
      );
    });
  });

  describe('validate', () => {
    it('should return true for valid build payload', async () => {
      const payload = {
        id: '147a3212-49fd-446f-b4e3-a6519acf264a',
        accountName: 'dsokal',
        projectName: 'example',
        appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
        platform: 'android' as const,
        status: 'finished' as const,
        buildDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a',
        metadata: {
          appName: 'example',
          appVersion: '1.0.2',
          buildProfile: 'production',
        },
        createdAt: '2021-11-24T09:53:01.155Z',
        updatedAt: '2021-11-24T09:57:42.715Z',
      };

      expect(await parser.validate(payload, {})).toBe(true);
    });

    it('should return true for valid submit payload', async () => {
      const payload = {
        id: '0374430d-7776-44ad-be7d-8513629adc54',
        accountName: 'dsokal',
        projectName: 'example',
        appId: '23c0e405-d282-4399-b280-5689c3e1ea85',
        platform: 'ios' as const,
        status: 'errored' as const,
        submissionDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/submissions/0374430d-7776-44ad-be7d-8513629adc54',
        archiveUrl: 'http://archive.url/abc.ipa',
        submissionInfo: {
          error: {
            message: 'Android version code needs to be updated',
            errorCode: 'SUBMISSION_SERVICE_ANDROID_OLD_VERSION_CODE_ERROR',
          },
        },
        createdAt: '2021-11-24T10:15:32.822Z',
        updatedAt: '2021-11-24T10:17:32.822Z',
      };

      expect(await parser.validate(payload, {})).toBe(true);
    });

    it('should return false for payload without required fields', async () => {
      const payload = {
        accountName: 'dsokal',
        projectName: 'example',
        // missing id, platform, status
      };

      expect(await parser.validate(payload, {})).toBe(false);
    });

    it('should return false for payload with invalid platform', async () => {
      const payload = {
        id: '147a3212-49fd-446f-b4e3-a6519acf264a',
        accountName: 'dsokal',
        projectName: 'example',
        appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
        platform: 'windows', // invalid platform
        status: 'finished' as const,
        buildDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a',
        createdAt: '2021-11-24T09:53:01.155Z',
        updatedAt: '2021-11-24T09:57:42.715Z',
      };

      expect(await parser.validate(payload, {})).toBe(false);
    });

    it('should return false for payload with invalid status', async () => {
      const payload = {
        id: '147a3212-49fd-446f-b4e3-a6519acf264a',
        accountName: 'dsokal',
        projectName: 'example',
        appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
        platform: 'android' as const,
        status: 'unknown', // invalid status
        buildDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a',
        createdAt: '2021-11-24T09:53:01.155Z',
        updatedAt: '2021-11-24T09:57:42.715Z',
      };

      expect(await parser.validate(payload, {})).toBe(false);
    });

    it('should return false for payload without build or submit fields', async () => {
      const payload = {
        id: '147a3212-49fd-446f-b4e3-a6519acf264a',
        accountName: 'dsokal',
        projectName: 'example',
        appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
        platform: 'android' as const,
        status: 'finished' as const,
        // missing buildDetailsPageUrl, metadata, submissionDetailsPageUrl, etc.
        createdAt: '2021-11-24T09:53:01.155Z',
        updatedAt: '2021-11-24T09:57:42.715Z',
      };

      expect(await parser.validate(payload, {})).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse build success payload correctly', async () => {
      const payload = {
        id: '147a3212-49fd-446f-b4e3-a6519acf264a',
        accountName: 'dsokal',
        projectName: 'example',
        appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
        platform: 'android' as const,
        status: 'finished' as const,
        buildDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a',
        artifacts: {
          buildUrl: 'https://expo.dev/artifacts/eas/wyodu9tua2ZuKKiaJ1Nbkn.aab',
        },
        metadata: {
          appName: 'example',
          appVersion: '1.0.2',
          appBuildVersion: '123',
          buildProfile: 'production',
          gitCommitMessage: 'Add home screen',
        },
        createdAt: '2021-11-24T09:53:01.155Z',
        updatedAt: '2021-11-24T09:57:42.715Z',
        completedAt: '2021-11-24T09:57:42.715Z',
      };

      const result = await parser.parse(payload);

      expect(result.title).toBe('🤖 ✅ EAS Build Finished');
      expect(result.subtitle).toBe('Build: example');
      expect(result.body).toContain('Project: example');
      expect(result.body).toContain('Platform: Android');
      expect(result.body).toContain('App Version: 1.0.2');
      expect(result.body).toContain('Build Version: 123');
      expect(result.body).toContain('Profile: production');
      expect(result.body).toContain('Commit: Add home screen');
      expect(result.body).toContain('Download: https://expo.dev/artifacts/eas/wyodu9tua2ZuKKiaJ1Nbkn.aab');
      expect(result.body).toContain('Build Details: https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse build error payload correctly', async () => {
      const payload = {
        id: '147a3212-49fd-446f-b4e3-a6519acf264a',
        accountName: 'dsokal',
        projectName: 'example',
        appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
        platform: 'ios' as const,
        status: 'errored' as const,
        buildDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a',
        error: {
          message: 'Unknown error. Please see logs.',
          errorCode: 'UNKNOWN_ERROR',
        },
        metadata: {
          appName: 'example',
          appVersion: '1.0.2',
        },
        createdAt: '2021-11-24T09:53:01.155Z',
        updatedAt: '2021-11-24T09:57:42.715Z',
        completedAt: '2021-11-24T09:57:42.715Z',
      };

      const result = await parser.parse(payload as any);

      expect(result.title).toBe('🍎 ❌ EAS Build Errored');
      expect(result.subtitle).toBe('Build: example');
      expect(result.body).toContain('Error: Unknown error. Please see logs.');
      expect(result.body).toContain('Error: Unknown error. Please see logs. (UNKNOWN_ERROR)');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse submit success payload correctly', async () => {
      const payload = {
        id: '0374430d-7776-44ad-be7d-8513629adc54',
        accountName: 'dsokal',
        projectName: 'example',
        appId: '23c0e405-d282-4399-b280-5689c3e1ea85',
        platform: 'android' as const,
        status: 'finished' as const,
        submissionDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/submissions/0374430d-7776-44ad-be7d-8513629adc54',
        archiveUrl: 'http://archive.url/abc.apk',
        createdAt: '2021-11-24T10:15:32.822Z',
        updatedAt: '2021-11-24T10:17:32.822Z',
        completedAt: '2021-11-24T10:17:32.822Z',
      };

      const result = await parser.parse(payload);

      expect(result.title).toBe('🤖 ✅ EAS Submit Finished');
      expect(result.subtitle).toBe('Submit: example');
      expect(result.body).toContain('Project: example');
      expect(result.body).toContain('Platform: Android');
      expect(result.body).toContain('Submission Details: https://expo.dev/accounts/dsokal/projects/example/submissions/0374430d-7776-44ad-be7d-8513629adc54');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse submit error payload correctly', async () => {
      const payload = {
        id: '0374430d-7776-44ad-be7d-8513629adc54',
        accountName: 'dsokal',
        projectName: 'example',
        appId: '23c0e405-d282-4399-b280-5689c3e1ea85',
        platform: 'ios' as const,
        status: 'errored' as const,
        submissionDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/submissions/0374430d-7776-44ad-be7d-8513629adc54',
        submissionInfo: {
          error: {
            message: 'iOS version code needs to be updated',
            errorCode: 'SUBMISSION_SERVICE_IOS_OLD_VERSION_CODE_ERROR',
          },
          logsUrl: 'https://submission-service-logs.s3-us-west-1.amazonaws.com/production/submission_728aa20b-f7a9-4da7-9b64-39911d427b19.txt',
        },
        createdAt: '2021-11-24T10:15:32.822Z',
        updatedAt: '2021-11-24T10:17:32.822Z',
        completedAt: '2021-11-24T10:17:32.822Z',
      };

      const result = await parser.parse(payload);

      expect(result.title).toBe('🍎 ❌ EAS Submit Errored');
      expect(result.subtitle).toBe('Submit: example');
      expect(result.body).toContain('Submission Error: iOS version code needs to be updated');
      expect(result.body).toContain('Submission Error: iOS version code needs to be updated (SUBMISSION_SERVICE_IOS_OLD_VERSION_CODE_ERROR)');
      expect(result.body).toContain('Logs: https://submission-service-logs.s3-us-west-1.amazonaws.com/production/submission_728aa20b-f7a9-4da7-9b64-39911d427b19.txt');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should include duration when available', async () => {
      const payload = {
        id: '147a3212-49fd-446f-b4e3-a6519acf264a',
        accountName: 'dsokal',
        projectName: 'example',
        appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
        platform: 'android' as const,
        status: 'finished' as const,
        buildDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a',
        createdAt: '2021-11-24T09:53:01.155Z',
        updatedAt: '2021-11-24T09:57:42.715Z',
        completedAt: '2021-11-24T09:57:42.715Z',
      };

      const result = await parser.parse(payload);

      expect(result.body).toContain('Duration:');
    });

    it('should include build artifacts for Android APK', async () => {
      const payload = {
        id: '147a3212-49fd-446f-b4e3-a6519acf264a',
        accountName: 'dsokal',
        projectName: 'example',
        appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
        platform: 'android' as const,
        status: 'finished' as const,
        buildDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a',
        artifacts: {
          buildUrl: 'https://expo.dev/artifacts/eas/example.apk',
        },
        createdAt: '2021-11-24T09:53:01.155Z',
        updatedAt: '2021-11-24T09:57:42.715Z',
      };

      const result = await parser.parse(payload);

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments![0].url).toBe('https://expo.dev/artifacts/eas/example.apk');
      expect(result.attachments![0].name).toBe('example Android APK');
    });

    it('should include build artifacts for iOS IPA', async () => {
      const payload = {
        id: '147a3212-49fd-446f-b4e3-a6519acf264a',
        accountName: 'dsokal',
        projectName: 'example',
        appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
        platform: 'ios' as const,
        status: 'finished' as const,
        buildDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a',
        artifacts: {
          buildUrl: 'https://expo.dev/artifacts/eas/example.ipa',
        },
        createdAt: '2021-11-24T09:53:01.155Z',
        updatedAt: '2021-11-24T09:57:42.715Z',
      };

      const result = await parser.parse(payload);

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments![0].url).toBe('https://expo.dev/artifacts/eas/example.ipa');
      expect(result.attachments![0].name).toBe('example iOS IPA');
    });
  });

  describe('signature verification', () => {
    const validPayload = {
      id: '147a3212-49fd-446f-b4e3-a6519acf264a',
      accountName: 'dsokal',
      projectName: 'example',
      appId: 'bc0a82de-65a5-4497-ad86-54ff1f53edf7',
      platform: 'android' as const,
      status: 'finished' as const,
      buildDetailsPageUrl: 'https://expo.dev/accounts/dsokal/projects/example/builds/147a3212-49fd-446f-b4e3-a6519acf264a',
      createdAt: '2021-11-24T09:53:01.155Z',
      updatedAt: '2021-11-24T09:57:42.715Z',
    };

    it('should validate payload without signature when no ExpoKey is configured', async () => {
      // Mock empty user settings (no ExpoKey configured)
      mockUsersService.getUserSettings.mockResolvedValue([]);

      const options = {
        userId: 'user-1',
        headers: {},
      };

      expect(await parser.validate(validPayload, options)).toBe(true);
    });

    it('should validate payload without signature when ExpoKey is not set', async () => {
      // Mock user settings without ExpoKey
      mockUsersService.getUserSettings.mockResolvedValue([
        { configType: UserSettingType.Language, valueText: 'en' }
      ]);

      const options = {
        userId: 'user-1',
        headers: {},
      };

      expect(await parser.validate(validPayload, options)).toBe(true);
    });

    it('should validate payload with correct signature', async () => {
      const secret = 'test-secret-key-12345';
      const payloadString = JSON.stringify(validPayload);

      // Create valid signature using the same method as the parser
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha1', secret);
      hmac.update(payloadString);
      const signature = `sha1=${hmac.digest('hex')}`;

      // Mock the user settings to return the secret
      mockUsersService.getUserSettings.mockResolvedValue([
        { configType: UserSettingType.ExpoKey, valueText: secret }
      ]);

      const options = {
        userId: 'user-1',
        headers: {
          'expo-signature': signature,
        },
      };

      expect(await parser.validate(validPayload, options)).toBe(true);
    });

    it('should reject payload with incorrect signature', async () => {
      // Mock the user settings to return a secret
      mockUsersService.getUserSettings.mockResolvedValue([
        { configType: UserSettingType.ExpoKey, valueText: 'test-secret-key-12345' }
      ]);

      const options = {
        userId: 'user-1',
        headers: {
          'expo-signature': 'sha1=incorrectsignature',
        },
      };

      expect(await parser.validate(validPayload, options)).toBe(false);
    });

    it('should parse payload with correct signature', async () => {
      const secret = 'test-secret-key-12345';
      const payloadString = JSON.stringify(validPayload);

      // Create valid signature using the same method as the parser
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha1', secret);
      hmac.update(payloadString);
      const signature = `sha1=${hmac.digest('hex')}`;

      // Mock the user settings to return the secret
      mockUsersService.getUserSettings.mockResolvedValue([
        { configType: UserSettingType.ExpoKey, valueText: secret }
      ]);

      const options = {
        userId: 'user-1',
        headers: {
          'expo-signature': signature,
        },
      };

      const result = await parser.parse(validPayload, options);
      expect(result).toBeDefined();
      expect(result.title).toContain('EAS Build');
    });

    it('should validate payload with incorrect signature as false', async () => {
      // Mock the user settings to return a secret
      mockUsersService.getUserSettings.mockResolvedValue([
        { configType: UserSettingType.ExpoKey, valueText: 'test-secret-key-12345' }
      ]);

      const options = {
        userId: 'user-1',
        headers: {
          'expo-signature': 'sha1=incorrectsignature',
        },
      };

      expect(await parser.validate(validPayload, options)).toBe(false);
    });
  });
});
