import { UseGuards } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AttachmentsCleanupScheduler } from './attachments.cleanup.scheduler';

@Resolver()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class AttachmentsCronResolver {
  constructor(
    private readonly attachmentsCleanupScheduler: AttachmentsCleanupScheduler,
  ) {}

  @Mutation(() => String, {
    name: 'triggerAttachmentsCleanup',
    description:
      'Manually trigger the attachments cleanup cron job (deletes attachments older than ATTACHMENTS_MAX_AGE)',
  })
  async triggerAttachmentsCleanup(): Promise<string> {
    const { deletedAttachments, skipped } =
      await this.attachmentsCleanupScheduler.runCleanupNow();
    if (skipped) {
      return 'Skipped: ATTACHMENTS_MAX_AGE not configured or <= 0';
    }
    return `Deleted ${deletedAttachments} attachment(s)`;
  }
}
