import { GitHubParser } from './github.parser';
import { NotificationDeliveryType } from '../../notifications/notifications.types';
import { UsersService } from '../../users/users.service';

describe('GitHubParser', () => {
  let parser: GitHubParser;
  let mockUsersService: jest.Mocked<UsersService>;

  beforeEach(() => {
    mockUsersService = {
      getUserSetting: jest.fn(),
      getMultipleUserSettings: jest.fn(),
    } as any;
    parser = new GitHubParser(mockUsersService);
  });

  it('should be defined', async () => {
    expect(parser).toBeDefined();
  });

  describe('validate', () => {
    it('should validate a valid GitHub payload', async () => {
      const payload = {
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'sender',
        },
      };

      expect(await parser.validate(payload, {})).toBe(true);
    });

    it('should validate ping event without repository', async () => {
      const payload = {
        hook: {
          type: 'Organization',
          id: 123,
          name: 'web',
          active: true,
          events: ['push'],
          config: {},
        },
        sender: {
          login: 'sender',
        },
      };

      expect(await parser.validate(payload, {})).toBe(true);
    });

    it('should reject payload without repository and without hook', async () => {
      const payload = {
        sender: {
          login: 'sender',
        },
      };

      expect(await parser.validate(payload, {})).toBe(false);
    });

    it('should reject payload without sender', async () => {
      const payload = {
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
      };

      expect(await parser.validate(payload, {})).toBe(false);
    });

    it('should reject invalid payload', async () => {
      expect(await parser.validate(null, {})).toBe(false);
      expect(await parser.validate(undefined, {})).toBe(false);
      expect(await parser.validate('invalid' as any, {})).toBe(false);
      expect(await parser.validate({}, {})).toBe(false);
    });
  });

  describe('parse - Push events', () => {
    it('should parse push event with single commit', async () => {
      const payload = {
        ref: 'refs/heads/main',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'developer',
        },
        commits: [
          {
            id: 'abc123def456',
            message: 'Fix bug in parser',
            author: {
              name: 'Developer',
              email: 'dev@example.com',
            },
            url: 'https://github.com/owner/test-repo/commit/abc123def456',
          },
        ],
        head_commit: {
          id: 'abc123def456',
          message: 'Fix bug in parser',
          author: {
            name: 'Developer',
            email: 'dev@example.com',
          },
          url: 'https://github.com/owner/test-repo/commit/abc123def456',
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('owner/test-repo');
      expect(result.title).toContain('1 commit pushed');
      expect(result.subtitle).toContain('main');
      expect(result.subtitle).toContain('developer');
      expect(result.body).toContain('Branch: main');
      expect(result.body).toContain('Author: developer');
      expect(result.body).toContain('abc123d');
      expect(result.body).toContain('Fix bug in parser');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse push event with multiple commits', async () => {
      const payload = {
        ref: 'refs/heads/develop',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'developer',
        },
        commits: [
          {
            id: 'abc123',
            message: 'First commit',
            author: {
              name: 'Developer',
              email: 'dev@example.com',
            },
            url: 'https://github.com/owner/test-repo/commit/abc123',
          },
          {
            id: 'def456',
            message: 'Second commit',
            author: {
              name: 'Developer',
              email: 'dev@example.com',
            },
            url: 'https://github.com/owner/test-repo/commit/def456',
          },
        ],
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('2 commits pushed');
      expect(result.body).toContain('Commits: 2');
    });
  });

  describe('parse - Pull Request events', () => {
    it('should parse pull request opened event', async () => {
      const payload = {
        action: 'opened',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'developer',
        },
        pull_request: {
          number: 42,
          title: 'Add new feature',
          state: 'open',
          html_url: 'https://github.com/owner/test-repo/pull/42',
          user: {
            login: 'developer',
          },
          draft: false,
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('owner/test-repo');
      expect(result.title).toContain('PR opened');
      expect(result.subtitle).toContain('#42');
      expect(result.subtitle).toContain('developer');
      expect(result.body).toContain('PR #42: Add new feature');
      expect(result.body).toContain('State: open');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse pull request merged event', async () => {
      const payload = {
        action: 'closed',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'maintainer',
        },
        pull_request: {
          number: 42,
          title: 'Add new feature',
          state: 'closed',
          html_url: 'https://github.com/owner/test-repo/pull/42',
          user: {
            login: 'developer',
          },
          merged: true,
          draft: false,
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('PR merged');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('parse - Issue events', () => {
    it('should parse issue opened event', async () => {
      const payload = {
        action: 'opened',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'user',
        },
        issue: {
          number: 15,
          title: 'Bug in feature X',
          state: 'open',
          html_url: 'https://github.com/owner/test-repo/issues/15',
          user: {
            login: 'user',
          },
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('Issue opened');
      expect(result.subtitle).toContain('#15');
      expect(result.body).toContain('Bug in feature X');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('parse - Release events', () => {
    it('should parse release published event', async () => {
      const payload = {
        action: 'published',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'maintainer',
        },
        release: {
          tag_name: 'v1.2.3',
          name: 'Release 1.2.3',
          html_url: 'https://github.com/owner/test-repo/releases/tag/v1.2.3',
          prerelease: false,
          draft: false,
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('Release published');
      expect(result.subtitle).toContain('v1.2.3');
      expect(result.body).toContain('Release 1.2.3');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('parse - Ping events', () => {
    it('should parse ping event for organization webhook', async () => {
      const payload = {
        zen: 'Mind your words, they are important.',
        hook_id: 575967546,
        hook: {
          type: 'Organization',
          id: 575967546,
          name: 'web',
          active: true,
          events: ['issues', 'registry_package', 'release', 'star', 'watch', 'workflow_job'],
          config: {
            content_type: 'json',
            insecure_ssl: '0',
            url: 'https://notifier-api.zentik.app/api/v1/messages/transform',
          },
        },
        organization: {
          login: 'Zentik-notifier',
          id: 225738097,
          url: 'https://api.github.com/orgs/Zentik-notifier',
          avatar_url: 'https://avatars.githubusercontent.com/u/225738097?v=4',
          description: '',
        },
        sender: {
          login: 'apocaliss92',
          avatar_url: 'https://avatars.githubusercontent.com/u/23080650?v=4',
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('Zentik-notifier');
      expect(result.title).toContain('Webhook Active');
      expect(result.subtitle).toContain('Zentik-notifier webhook ready');
      expect(result.body).toContain('Webhook configured successfully');
      expect(result.body).toContain('Type: Organization');
      expect(result.body).toContain('Configured by: apocaliss92');
      expect(result.body).toContain('issues');
      expect(result.body).toContain('release');
      expect(result.body).toContain('Mind your words, they are important');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse ping event without organization', async () => {
      const payload = {
        zen: 'Design for failure.',
        hook: {
          type: 'Repository',
          id: 123456,
          name: 'web',
          active: true,
          events: ['push', 'pull_request'],
          config: {},
        },
        sender: {
          login: 'developer',
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('Webhook Active');
      expect(result.subtitle).toContain('webhook ready');
      expect(result.body).toContain('Webhook configured successfully');
      expect(result.body).toContain('Type: Repository');
      expect(result.body).toContain('push');
      expect(result.body).toContain('Design for failure');
    });
  });

  describe('parse - Workflow events', () => {
    it('should parse workflow run success', async () => {
      const payload = {
        action: 'completed',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'developer',
        },
        workflow_run: {
          id: 123456,
          name: 'CI',
          head_branch: 'main',
          status: 'completed',
          conclusion: 'success',
          html_url:
            'https://github.com/owner/test-repo/actions/runs/123456',
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('Workflow');
      expect(result.subtitle).toContain('CI');
      expect(result.body).toContain('Status: completed');
      expect(result.body).toContain('Conclusion: success');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse workflow run failure as CRITICAL', async () => {
      const payload = {
        action: 'completed',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'developer',
        },
        workflow_run: {
          id: 123456,
          name: 'CI',
          head_branch: 'main',
          status: 'completed',
          conclusion: 'failure',
          html_url:
            'https://github.com/owner/test-repo/actions/runs/123456',
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('parse - Workflow Job events', () => {
    it('should parse workflow job queued event as SILENT', async () => {
      const payload = {
        action: 'queued',
        repository: {
          name: 'frontend',
          full_name: 'Zentik-notifier/frontend',
          html_url: 'https://github.com/Zentik-notifier/frontend',
          owner: {
            login: 'Zentik-notifier',
          },
        },
        sender: {
          login: 'apocaliss92',
        },
        workflow_job: {
          id: 53079579758,
          run_id: 18615540235,
          workflow_name: 'TypeScript Check',
          name: 'TypeScript Type Check',
          head_branch: 'main',
          status: 'queued',
          conclusion: undefined,
          html_url: 'https://github.com/Zentik-notifier/frontend/actions/runs/18615540235/job/53079579758',
          created_at: '2025-10-18T12:21:31Z',
          started_at: '2025-10-18T12:21:31Z',
          completed_at: undefined,
          steps: [],
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('TypeScript Type Check');
      expect(result.title).toContain('🔄');
      expect(result.title).toContain('queued');
      expect(result.subtitle).toBe('TypeScript Check');
      expect(result.body).toContain('Job: TypeScript Type Check');
      expect(result.body).toContain('Workflow: TypeScript Check');
      expect(result.body).toContain('Branch: main');
      expect(result.body).toContain('Status: queued');
      expect(result.deliveryType).toBe(NotificationDeliveryType.SILENT);
    });

    it('should parse workflow job in_progress event as SILENT', async () => {
      const payload = {
        action: 'in_progress',
        repository: {
          name: 'frontend',
          full_name: 'Zentik-notifier/frontend',
          html_url: 'https://github.com/Zentik-notifier/frontend',
          owner: {
            login: 'Zentik-notifier',
          },
        },
        sender: {
          login: 'apocaliss92',
        },
        workflow_job: {
          id: 53079579758,
          run_id: 18615540235,
          workflow_name: 'TypeScript Check',
          name: 'TypeScript Type Check',
          head_branch: 'main',
          status: 'in_progress',
          conclusion: undefined,
          html_url: 'https://github.com/Zentik-notifier/frontend/actions/runs/18615540235/job/53079579758',
          created_at: '2025-10-18T12:21:31Z',
          started_at: '2025-10-18T12:21:33Z',
          completed_at: undefined,
          steps: [],
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('TypeScript Type Check');
      expect(result.title).toContain('⏳');
      expect(result.title).toContain('in progress');
      expect(result.subtitle).toBe('TypeScript Check');
      expect(result.body).toContain('Job: TypeScript Type Check');
      expect(result.body).toContain('Status: in progress');
      expect(result.deliveryType).toBe(NotificationDeliveryType.SILENT);
    });

    it('should parse workflow job completed success event as NORMAL', async () => {
      const payload = {
        action: 'completed',
        repository: {
          name: 'frontend',
          full_name: 'Zentik-notifier/frontend',
          html_url: 'https://github.com/Zentik-notifier/frontend',
          owner: {
            login: 'Zentik-notifier',
          },
        },
        sender: {
          login: 'apocaliss92',
        },
        workflow_job: {
          id: 53079579758,
          run_id: 18615540235,
          workflow_name: 'TypeScript Check',
          name: 'TypeScript Type Check',
          head_branch: 'main',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/Zentik-notifier/frontend/actions/runs/18615540235/job/53079579758',
          created_at: '2025-10-18T12:21:31Z',
          started_at: '2025-10-18T12:21:33Z',
          completed_at: '2025-10-18T12:22:17Z',
          steps: [
            {
              name: 'Setup Node.js',
              status: 'completed',
              conclusion: 'success',
              number: 3,
              started_at: '2025-10-18T12:21:35Z',
              completed_at: '2025-10-18T12:21:37Z',
            },
          ],
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('TypeScript Type Check');
      expect(result.title).toContain('✅');
      expect(result.title).toContain('completed successfully');
      expect(result.subtitle).toBe('TypeScript Check');
      expect(result.body).toContain('Job: TypeScript Type Check');
      expect(result.body).toContain('Workflow: TypeScript Check');
      expect(result.body).toContain('Conclusion: success');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse workflow job failure event as CRITICAL', async () => {
      const payload = {
        action: 'completed',
        repository: {
          name: 'frontend',
          full_name: 'Zentik-notifier/frontend',
          html_url: 'https://github.com/Zentik-notifier/frontend',
          owner: {
            login: 'Zentik-notifier',
          },
        },
        sender: {
          login: 'apocaliss92',
        },
        workflow_job: {
          id: 53079579758,
          run_id: 18615540235,
          workflow_name: 'TypeScript Check',
          name: 'TypeScript Type Check',
          head_branch: 'main',
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/Zentik-notifier/frontend/actions/runs/18615540235/job/53079579758',
          created_at: '2025-10-18T12:21:31Z',
          started_at: '2025-10-18T12:21:33Z',
          completed_at: '2025-10-18T12:22:17Z',
          steps: [],
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('TypeScript Type Check');
      expect(result.title).toContain('❌');
      expect(result.title).toContain('failed');
      expect(result.subtitle).toBe('TypeScript Check');
      expect(result.body).toContain('Conclusion: failure');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('parse - Star and Fork events', () => {
    it('should parse star event', async () => {
      const payload = {
        action: 'created',
        starred_at: '2025-10-13T10:00:00Z',
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'stargazer',
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('New Star');
      expect(result.subtitle).toContain('stargazer');
      expect(result.body).toContain('starred');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse fork event', async () => {
      const payload = {
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
          html_url: 'https://github.com/owner/test-repo',
          owner: {
            login: 'owner',
          },
        },
        sender: {
          login: 'forker',
        },
        forkee: {
          full_name: 'forker/test-repo',
          html_url: 'https://github.com/forker/test-repo',
        },
      };

      const result = await parser.parse(payload, {});

      expect(result.title).toContain('Repository Forked');
      expect(result.subtitle).toContain('forker');
      expect(result.body).toContain('forked to forker/test-repo');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });

  describe('Special Filters - ALL_SUCCESS and ALL_FAILURE', () => {
    it('should filter only success events with ALL_SUCCESS', async () => {
      // Mock usersService to return ALL_SUCCESS filter
      mockUsersService.getUserSetting.mockResolvedValue({ valueText: 'ALL_SUCCESS' } as any);

      // Success event - workflow job success
      const successPayload = {
        repository: { name: 'test-repo', full_name: 'owner/test-repo', html_url: 'https://github.com/owner/test-repo', owner: { login: 'owner' } },
        sender: { login: 'sender' },
        workflow_job: { conclusion: 'success', name: 'test-job', workflow_name: 'test-workflow', head_branch: 'main', status: 'completed' }
      };

      // Failure event - workflow job failure
      const failurePayload = {
        repository: { name: 'test-repo', full_name: 'owner/test-repo', html_url: 'https://github.com/owner/test-repo', owner: { login: 'owner' } },
        sender: { login: 'sender' },
        workflow_job: { conclusion: 'failure', name: 'test-job', workflow_name: 'test-workflow', head_branch: 'main', status: 'completed' }
      };

      expect(await parser.validate(successPayload, { userId: 'test-user' })).toBe(true);
      expect(await parser.validate(failurePayload, { userId: 'test-user' })).toBe(false);
    });

    it('should filter only failure events with ALL_FAILURE', async () => {
      // Mock usersService to return ALL_FAILURE filter
      mockUsersService.getUserSetting.mockResolvedValue({ valueText: 'ALL_FAILURE' } as any);

      // Success event - workflow job success
      const successPayload = {
        repository: { name: 'test-repo', full_name: 'owner/test-repo', html_url: 'https://github.com/owner/test-repo', owner: { login: 'owner' } },
        sender: { login: 'sender' },
        workflow_job: { conclusion: 'success', name: 'test-job', workflow_name: 'test-workflow', head_branch: 'main', status: 'completed' }
      };

      // Failure event - workflow job failure
      const failurePayload = {
        repository: { name: 'test-repo', full_name: 'owner/test-repo', html_url: 'https://github.com/owner/test-repo', owner: { login: 'owner' } },
        sender: { login: 'sender' },
        workflow_job: { conclusion: 'failure', name: 'test-job', workflow_name: 'test-workflow', head_branch: 'main', status: 'completed' }
      };

      expect(await parser.validate(successPayload, { userId: 'test-user' })).toBe(false);
      expect(await parser.validate(failurePayload, { userId: 'test-user' })).toBe(true);
    });

    it('should handle case-insensitive special filters', async () => {
      // Mock usersService to return all_success (lowercase)
      mockUsersService.getUserSetting.mockResolvedValue({ valueText: 'all_success' } as any);

      // Success event - PR merged
      const successPayload = {
        repository: { name: 'test-repo', full_name: 'owner/test-repo', html_url: 'https://github.com/owner/test-repo', owner: { login: 'owner' } },
        sender: { login: 'sender' },
        action: 'closed',
        pull_request: { number: 1, title: 'Test PR', state: 'closed', html_url: 'https://github.com/owner/test-repo/pull/1', user: { login: 'author' }, merged: true }
      };

      expect(await parser.validate(successPayload, { userId: 'test-user' })).toBe(true);
    });
  });

  describe('getTestPayload', () => {
    it('should return a valid test payload', async () => {
      const testPayload = parser.getTestPayload();

      expect(testPayload).toBeDefined();
      expect(testPayload.repository).toBeDefined();
      expect(testPayload.sender).toBeDefined();
      expect(await parser.validate(testPayload, {})).toBe(true);
    });
  });
});
