import { Test, TestingModule } from '@nestjs/testing';
import { GitHubParser } from './github.parser';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

describe('GitHubParser', () => {
  let parser: GitHubParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitHubParser],
    }).compile();

    parser = module.get<GitHubParser>(GitHubParser);
  });

  it('should be defined', () => {
    expect(parser).toBeDefined();
  });

  describe('validate', () => {
    it('should validate a valid GitHub payload', () => {
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

      expect(parser.validate(payload)).toBe(true);
    });

    it('should reject payload without repository', () => {
      const payload = {
        sender: {
          login: 'sender',
        },
      };

      expect(parser.validate(payload)).toBe(false);
    });

    it('should reject payload without sender', () => {
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

      expect(parser.validate(payload)).toBe(false);
    });

    it('should reject invalid payload', () => {
      expect(parser.validate(null)).toBe(false);
      expect(parser.validate(undefined)).toBe(false);
      expect(parser.validate('invalid')).toBe(false);
      expect(parser.validate({})).toBe(false);
    });
  });

  describe('parse - Push events', () => {
    it('should parse push event with single commit', () => {
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

      const result = parser.parse(payload);

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

    it('should parse push event with multiple commits', () => {
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

      const result = parser.parse(payload);

      expect(result.title).toContain('2 commits pushed');
      expect(result.body).toContain('Commits: 2');
    });
  });

  describe('parse - Pull Request events', () => {
    it('should parse pull request opened event', () => {
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

      const result = parser.parse(payload);

      expect(result.title).toContain('owner/test-repo');
      expect(result.title).toContain('PR opened');
      expect(result.subtitle).toContain('#42');
      expect(result.subtitle).toContain('developer');
      expect(result.body).toContain('PR #42: Add new feature');
      expect(result.body).toContain('State: open');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });

    it('should parse pull request merged event', () => {
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

      const result = parser.parse(payload);

      expect(result.title).toContain('PR merged');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('parse - Issue events', () => {
    it('should parse issue opened event', () => {
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

      const result = parser.parse(payload);

      expect(result.title).toContain('Issue opened');
      expect(result.subtitle).toContain('#15');
      expect(result.body).toContain('Bug in feature X');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('parse - Release events', () => {
    it('should parse release published event', () => {
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

      const result = parser.parse(payload);

      expect(result.title).toContain('Release published');
      expect(result.subtitle).toContain('v1.2.3');
      expect(result.body).toContain('Release 1.2.3');
      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('parse - Workflow events', () => {
    it('should parse workflow run success', () => {
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

      const result = parser.parse(payload);

      expect(result.title).toContain('Workflow');
      expect(result.subtitle).toContain('CI');
      expect(result.body).toContain('Status: completed');
      expect(result.body).toContain('Conclusion: success');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse workflow run failure as CRITICAL', () => {
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

      const result = parser.parse(payload);

      expect(result.deliveryType).toBe(NotificationDeliveryType.CRITICAL);
    });
  });

  describe('parse - Star and Fork events', () => {
    it('should parse star event', () => {
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

      const result = parser.parse(payload);

      expect(result.title).toContain('New Star');
      expect(result.subtitle).toContain('stargazer');
      expect(result.body).toContain('starred');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });

    it('should parse fork event', () => {
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

      const result = parser.parse(payload);

      expect(result.title).toContain('Repository Forked');
      expect(result.subtitle).toContain('forker');
      expect(result.body).toContain('forked to forker/test-repo');
      expect(result.deliveryType).toBe(NotificationDeliveryType.NORMAL);
    });
  });

  describe('getTestPayload', () => {
    it('should return a valid test payload', () => {
      const testPayload = parser.getTestPayload();

      expect(testPayload).toBeDefined();
      expect(testPayload.repository).toBeDefined();
      expect(testPayload.sender).toBeDefined();
      expect(parser.validate(testPayload)).toBe(true);
    });
  });
});
