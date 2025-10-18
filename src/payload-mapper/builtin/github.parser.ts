import { Injectable } from '@nestjs/common';
import { PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';
import { IBuiltinParser, ParserOptions } from './builtin-parser.interface';
import { CreateMessageDto } from '../../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../../notifications/notifications.types';

export interface GitHubWebhookPayload {
  action?: string;
  ref?: string;
  ref_type?: string;
  // Ping event
  zen?: string;
  hook_id?: number;
  hook?: {
    type: string;
    id: number;
    name: string;
    active: boolean;
    events: string[];
    config: {
      content_type?: string;
      insecure_ssl?: string;
      url?: string;
    };
  };
  organization?: {
    login: string;
    id: number;
    url: string;
    avatar_url?: string;
    description?: string;
  };
  repository?: {
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      login: string;
      avatar_url?: string;
    };
  };
  sender: {
    login: string;
    avatar_url?: string;
  };
  // Push events
  commits?: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    url: string;
  }>;
  head_commit?: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    url: string;
  };
  // Pull Request events
  pull_request?: {
    number: number;
    title: string;
    state: string;
    html_url: string;
    user: {
      login: string;
    };
    merged?: boolean;
    draft?: boolean;
  };
  // Issue events
  issue?: {
    number: number;
    title: string;
    state: string;
    html_url: string;
    user: {
      login: string;
    };
  };
  // Release events
  release?: {
    tag_name: string;
    name: string;
    body?: string;
    html_url: string;
    prerelease: boolean;
    draft: boolean;
  };
  // Workflow events
  workflow?: {
    name: string;
    path: string;
  };
  workflow_run?: {
    id: number;
    name: string;
    head_branch: string;
    status: string;
    conclusion?: string;
    html_url: string;
  };
  // Star events
  starred_at?: string;
  // Fork events
  forkee?: {
    full_name: string;
    html_url: string;
  };
  // Check suite/run events
  check_suite?: {
    status: string;
    conclusion?: string;
    head_branch: string;
    html_url: string;
  };
  check_run?: {
    name: string;
    status: string;
    conclusion?: string;
    html_url: string;
  };
  // Discussion events
  discussion?: {
    title: string;
    html_url: string;
    user: {
      login: string;
    };
  };
}

@Injectable()
export class GitHubParser implements IBuiltinParser {
  get builtInType(): PayloadMapperBuiltInType {
    return PayloadMapperBuiltInType.ZENTIK_GITHUB;
  }

  get name(): string {
    return 'ZentikGitHub';
  }

  get description(): string {
    return 'Parser for GitHub webhooks - handles ping, push, pull requests, issues, releases, workflows, and more';
  }

  async validate(payload: any, options?: ParserOptions): Promise<boolean> {
    return new Promise(resolve => resolve(this.syncValidate(payload, options)));
  }

  private syncValidate(payload: any, options?: ParserOptions): boolean {
    // Headers are available if needed for future webhook signature verification
    // For now, GitHub doesn't require signature verification in this parser
    
    // Validate ping event (webhook setup/test)
    if (payload?.hook && payload?.sender?.login) {
      return true;
    }
    
    // Validate regular GitHub events
    return !!(
      payload &&
      typeof payload === 'object' &&
      payload.repository?.name &&
      payload.sender?.login
    );
  }

  async parse(payload: GitHubWebhookPayload, options?: ParserOptions): Promise<CreateMessageDto> {
    return new Promise(resolve => resolve(this.syncParse(payload, options)));
  }

  private syncParse(payload: GitHubWebhookPayload, options?: ParserOptions): CreateMessageDto {
    try {
      return this.createMessage(payload);
    } catch (error) {
      console.error('Error parsing GitHub payload:', error);
      return this.createErrorMessage(payload);
    }
  }

  private createMessage(payload: GitHubWebhookPayload): CreateMessageDto {
    const { repository, sender, action, organization } = payload;
    
    // Determine event type from payload structure
    const eventType = this.detectEventType(payload);
    const { title, subtitle, body } = this.formatMessage(eventType, payload);
    const deliveryType = this.getDeliveryType(eventType, payload);

    // For ping events, use organization or hook context instead of repository
    let prefix = '';
    if (repository) {
      const repoName = repository.full_name || repository.name;
      prefix = `${repoName}: `;
    } else if (organization) {
      prefix = `${organization.login}: `;
    } else if (payload.hook) {
      prefix = 'GitHub: ';
    }

    return {
      title: `${prefix}${title}`,
      subtitle,
      body,
      deliveryType,
      bucketId: '', // Will be set by the service
    } as CreateMessageDto;
  }

  private detectEventType(payload: GitHubWebhookPayload): string {
    if (payload.zen && payload.hook) return 'ping';
    if (payload.commits || payload.head_commit) return 'push';
    if (payload.pull_request) return 'pull_request';
    if (payload.issue) return 'issue';
    if (payload.release) return 'release';
    if (payload.workflow_run) return 'workflow_run';
    if (payload.check_suite) return 'check_suite';
    if (payload.check_run) return 'check_run';
    if (payload.starred_at) return 'star';
    if (payload.forkee) return 'fork';
    if (payload.discussion) return 'discussion';
    if (payload.ref_type) return payload.ref_type; // branch/tag creation
    return 'unknown';
  }

  private formatMessage(
    eventType: string,
    payload: GitHubWebhookPayload,
  ): { title: string; subtitle: string; body: string } {
    const { sender, action } = payload;

    switch (eventType) {
      case 'ping':
        return this.formatPingEvent(payload);
      case 'push':
        return this.formatPushEvent(payload);
      case 'pull_request':
        return this.formatPullRequestEvent(payload);
      case 'issue':
        return this.formatIssueEvent(payload);
      case 'release':
        return this.formatReleaseEvent(payload);
      case 'workflow_run':
        return this.formatWorkflowRunEvent(payload);
      case 'check_suite':
        return this.formatCheckSuiteEvent(payload);
      case 'check_run':
        return this.formatCheckRunEvent(payload);
      case 'star':
        return {
          title: '⭐ New Star',
          subtitle: `by ${sender.login}`,
          body: `${sender.login} starred the repository`,
        };
      case 'fork':
        return {
          title: '🍴 Repository Forked',
          subtitle: `by ${sender.login}`,
          body: `${sender.login} forked to ${payload.forkee?.full_name}`,
        };
      case 'discussion':
        return this.formatDiscussionEvent(payload);
      case 'branch':
      case 'tag':
        return {
          title: `${eventType === 'branch' ? '🌿' : '🏷️'} ${eventType.charAt(0).toUpperCase() + eventType.slice(1)} ${action}`,
          subtitle: payload.ref || '',
          body: `${sender.login} ${action} ${eventType} ${payload.ref || 'unknown'}`,
        };
      default:
        return {
          title: action ? `${action} event` : 'GitHub event',
          subtitle: `by ${sender.login}`,
          body: `Event triggered by ${sender.login}`,
        };
    }
  }

  private formatPingEvent(payload: GitHubWebhookPayload): {
    title: string;
    subtitle: string;
    body: string;
  } {
    const { sender, hook, organization, zen } = payload;
    const hookType = hook?.type || 'Unknown';
    const events = hook?.events || [];
    const context = organization ? organization.login : 'webhook';
    
    let body = `🎉 Webhook configured successfully!\n\n`;
    body += `Type: ${hookType}\n`;
    body += `Configured by: ${sender.login}\n`;
    
    if (events.length > 0) {
      body += `Monitoring events:\n`;
      events.forEach(event => {
        body += `• ${event}\n`;
      });
    }
    
    if (zen) {
      body += `\n💭 "${zen}"`;
    }

    return {
      title: '🔔 Webhook Active',
      subtitle: `${context} webhook ready`,
      body,
    };
  }

  private formatPushEvent(payload: GitHubWebhookPayload): {
    title: string;
    subtitle: string;
    body: string;
  } {
    const { sender, commits, head_commit, ref } = payload;
    const branch = ref?.replace('refs/heads/', '') || 'unknown';
    const commitCount = commits?.length || 0;
    const commitWord = commitCount === 1 ? 'commit' : 'commits';

    let body = `Branch: ${branch}\n`;
    body += `Author: ${sender.login}\n`;
    body += `Commits: ${commitCount}\n\n`;

    if (head_commit) {
      const shortSha = head_commit.id.substring(0, 7);
      const commitMessage = head_commit.message.split('\n')[0]; // First line only
      body += `Latest: ${shortSha} - ${commitMessage}`;
    } else if (commits && commits.length > 0) {
      body += 'Commits:\n';
      commits.slice(-3).forEach((commit) => {
        const shortSha = commit.id.substring(0, 7);
        const message = commit.message.split('\n')[0];
        body += `• ${shortSha} - ${message}\n`;
      });
    }

    return {
      title: `📝 ${commitCount} ${commitWord} pushed`,
      subtitle: `to ${branch} by ${sender.login}`,
      body,
    };
  }

  private formatPullRequestEvent(payload: GitHubWebhookPayload): {
    title: string;
    subtitle: string;
    body: string;
  } {
    const { pull_request, action, sender } = payload;
    if (!pull_request) {
      return { title: 'PR event', subtitle: '', body: '' };
    }

    const prNumber = pull_request.number;
    const prTitle = pull_request.title;
    const prState = pull_request.state;
    const isDraft = pull_request.draft;

    let emoji = '🔀';
    let actionText = action || 'updated';

    if (action === 'opened') emoji = '🆕';
    else if (action === 'closed' && pull_request.merged) {
      emoji = '✅';
      actionText = 'merged';
    } else if (action === 'closed') {
      emoji = '❌';
      actionText = 'closed';
    } else if (action === 'reopened') emoji = '🔄';
    else if (action === 'ready_for_review') {
      emoji = '👀';
      actionText = 'ready for review';
    }

    const body = `PR #${prNumber}: ${prTitle}\nAuthor: ${pull_request.user.login}\nState: ${prState}${isDraft ? ' (draft)' : ''}\nAction by: ${sender.login}`;

    return {
      title: `${emoji} PR ${actionText}`,
      subtitle: `#${prNumber} by ${pull_request.user.login}`,
      body,
    };
  }

  private formatIssueEvent(payload: GitHubWebhookPayload): {
    title: string;
    subtitle: string;
    body: string;
  } {
    const { issue, action, sender } = payload;
    if (!issue) {
      return { title: 'Issue event', subtitle: '', body: '' };
    }

    const issueNumber = issue.number;
    const issueTitle = issue.title;
    const issueState = issue.state;

    let emoji = '📋';
    let actionText = action || 'updated';

    if (action === 'opened') emoji = '🆕';
    else if (action === 'closed') emoji = '✅';
    else if (action === 'reopened') emoji = '🔄';

    const body = `Issue #${issueNumber}: ${issueTitle}\nAuthor: ${issue.user.login}\nState: ${issueState}\nAction by: ${sender.login}`;

    return {
      title: `${emoji} Issue ${actionText}`,
      subtitle: `#${issueNumber} by ${issue.user.login}`,
      body,
    };
  }

  private formatReleaseEvent(payload: GitHubWebhookPayload): {
    title: string;
    subtitle: string;
    body: string;
  } {
    const { release, action, sender } = payload;
    if (!release) {
      return { title: 'Release event', subtitle: '', body: '' };
    }

    const tag = release.tag_name;
    const name = release.name || tag;
    const isPrerelease = release.prerelease;
    const isDraft = release.draft;

    let emoji = '🚀';
    if (isPrerelease) emoji = '🧪';
    if (isDraft) emoji = '📝';

    const body = `Release: ${name}\nTag: ${tag}\n${isPrerelease ? 'Pre-release\n' : ''}${isDraft ? 'Draft\n' : ''}Published by: ${sender.login}`;

    return {
      title: `${emoji} Release ${action}`,
      subtitle: tag,
      body,
    };
  }

  private formatWorkflowRunEvent(payload: GitHubWebhookPayload): {
    title: string;
    subtitle: string;
    body: string;
  } {
    const { workflow_run, action, sender } = payload;
    if (!workflow_run) {
      return { title: 'Workflow event', subtitle: '', body: '' };
    }

    const workflowName = workflow_run.name;
    const status = workflow_run.status;
    const conclusion = workflow_run.conclusion;
    const branch = workflow_run.head_branch;

    let emoji = '⚙️';
    if (conclusion === 'success') emoji = '✅';
    else if (conclusion === 'failure') emoji = '❌';
    else if (conclusion === 'cancelled') emoji = '🚫';
    else if (status === 'in_progress') emoji = '⏳';

    const body = `Workflow: ${workflowName}\nBranch: ${branch}\nStatus: ${status}\n${conclusion ? `Conclusion: ${conclusion}\n` : ''}Triggered by: ${sender.login}`;

    return {
      title: `${emoji} Workflow ${action || status}`,
      subtitle: workflowName,
      body,
    };
  }

  private formatCheckSuiteEvent(payload: GitHubWebhookPayload): {
    title: string;
    subtitle: string;
    body: string;
  } {
    const { check_suite, action, sender } = payload;
    if (!check_suite) {
      return { title: 'Check suite event', subtitle: '', body: '' };
    }

    const status = check_suite.status;
    const conclusion = check_suite.conclusion;
    const branch = check_suite.head_branch;

    let emoji = '🔍';
    if (conclusion === 'success') emoji = '✅';
    else if (conclusion === 'failure') emoji = '❌';
    else if (status === 'in_progress') emoji = '⏳';

    const body = `Branch: ${branch}\nStatus: ${status}\n${conclusion ? `Conclusion: ${conclusion}\n` : ''}Triggered by: ${sender.login}`;

    return {
      title: `${emoji} Check suite ${action || status}`,
      subtitle: branch,
      body,
    };
  }

  private formatCheckRunEvent(payload: GitHubWebhookPayload): {
    title: string;
    subtitle: string;
    body: string;
  } {
    const { check_run, action, sender } = payload;
    if (!check_run) {
      return { title: 'Check run event', subtitle: '', body: '' };
    }

    const name = check_run.name;
    const status = check_run.status;
    const conclusion = check_run.conclusion;

    let emoji = '🔍';
    if (conclusion === 'success') emoji = '✅';
    else if (conclusion === 'failure') emoji = '❌';
    else if (status === 'in_progress') emoji = '⏳';

    const body = `Check: ${name}\nStatus: ${status}\n${conclusion ? `Conclusion: ${conclusion}\n` : ''}Triggered by: ${sender.login}`;

    return {
      title: `${emoji} Check ${action || status}`,
      subtitle: name,
      body,
    };
  }

  private formatDiscussionEvent(payload: GitHubWebhookPayload): {
    title: string;
    subtitle: string;
    body: string;
  } {
    const { discussion, action, sender } = payload;
    if (!discussion) {
      return { title: 'Discussion event', subtitle: '', body: '' };
    }

    const title = discussion.title;

    let emoji = '💬';
    let actionText = action || 'updated';

    if (action === 'created') emoji = '🆕';
    else if (action === 'answered') emoji = '✅';
    else if (action === 'closed') emoji = '🔒';

    const body = `Discussion: ${title}\nAuthor: ${discussion.user.login}\nAction by: ${sender.login}`;

    return {
      title: `${emoji} Discussion ${actionText}`,
      subtitle: title,
      body,
    };
  }

  private getDeliveryType(
    eventType: string,
    payload: GitHubWebhookPayload,
  ): NotificationDeliveryType {
    // Critical: workflow/check failures
    if (eventType === 'workflow_run' && payload.workflow_run?.conclusion === 'failure') {
      return NotificationDeliveryType.CRITICAL;
    }
    if (eventType === 'check_suite' && payload.check_suite?.conclusion === 'failure') {
      return NotificationDeliveryType.CRITICAL;
    }
    if (eventType === 'check_run' && payload.check_run?.conclusion === 'failure') {
      return NotificationDeliveryType.CRITICAL;
    }

    // Important: PRs, issues opened/closed, releases
    if (
      (eventType === 'pull_request' &&
        ['opened', 'closed', 'ready_for_review'].includes(payload.action || '')) ||
      (eventType === 'issue' && ['opened', 'closed'].includes(payload.action || '')) ||
      eventType === 'release'
    ) {
      return NotificationDeliveryType.CRITICAL;
    }

    // Normal priority for everything else
    return NotificationDeliveryType.NORMAL;
  }

  private createErrorMessage(payload: any): CreateMessageDto {
    return {
      title: '❌ GitHub webhook parsing error',
      subtitle: 'Parser ZentikGitHub',
      body: `An error occurred while parsing the GitHub payload.\n\nReceived payload:\n${JSON.stringify(payload, null, 2).substring(0, 500)}...`,
      deliveryType: NotificationDeliveryType.CRITICAL,
      bucketId: '',
    } as CreateMessageDto;
  }

  getTestPayload(): GitHubWebhookPayload {
    return {
      action: 'opened',
      repository: {
        name: 'zentik-notifier',
        full_name: 'Zentik-notifier/zentik-notifier',
        html_url: 'https://github.com/Zentik-notifier/zentik-notifier',
        owner: {
          login: 'Zentik-notifier',
          avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        },
      },
      sender: {
        login: 'developer',
        avatar_url: 'https://avatars.githubusercontent.com/u/67890',
      },
      pull_request: {
        number: 42,
        title: 'Add GitHub webhook parser',
        state: 'open',
        html_url:
          'https://github.com/Zentik-notifier/zentik-notifier/pull/42',
        user: {
          login: 'developer',
        },
        draft: false,
      },
    };
  }
}
