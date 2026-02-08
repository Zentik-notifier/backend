import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { NotificationPostpone } from '../entities/notification-postpone.entity';
import { Notification } from '../entities/notification.entity';
import { PushNotificationOrchestratorService } from './push-orchestrator.service';

@Injectable()
export class NotificationPostponeService {
  private readonly logger = new Logger(NotificationPostponeService.name);

  constructor(
    @InjectRepository(NotificationPostpone)
    private readonly postponeRepository: Repository<NotificationPostpone>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly pushOrchestrator: PushNotificationOrchestratorService,
  ) {}

  /**
   * Create a postpone entry for a notification
   */
  async createPostpone(
    notificationId: string,
    userId: string,
    minutes: number,
  ): Promise<NotificationPostpone> {
    // Verify the notification exists and belongs to the user
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
      relations: ['message', 'user'],
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification ${notificationId} not found for user ${userId}`,
      );
    }

    const sendAt = new Date();
    sendAt.setMinutes(sendAt.getMinutes() + minutes);

    const postpone = this.postponeRepository.create({
      notificationId,
      messageId: notification.message.id,
      userId,
      sendAt,
    });

    const saved = await this.postponeRepository.save(postpone);
    this.logger.log(
      `Created postpone ${saved.id} for notification ${notificationId} to be sent at ${sendAt.toISOString()}`,
    );

    return saved;
  }

  /**
   * Find all pending postpones for a user.
   * Excludes postpones whose message has no bucket (e.g. bucket was deleted) so GraphQL never returns null for Message.bucket.
   */
  async findPendingByUser(userId: string): Promise<NotificationPostpone[]> {
    const list = await this.postponeRepository.find({
      where: { userId },
      relations: ['notification', 'message', 'message.bucket', 'user'],
      order: { sendAt: 'ASC' },
    });
    return list.filter((p) => p.message?.bucket != null);
  }

  /**
   * Find all postpones that are ready to be sent
   */
  async findReadyToSend(): Promise<NotificationPostpone[]> {
    const now = new Date();
    return this.postponeRepository.find({
      where: {
        sendAt: LessThanOrEqual(now),
      },
      relations: ['notification', 'notification.message', 'message', 'user', 'notification.userDevice'],
    });
  }

  /**
   * Cancel a postpone
   */
  async cancelPostpone(
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const postpone = await this.postponeRepository.findOne({
      where: { id, userId },
    });

    if (!postpone) {
      throw new NotFoundException(
        `Postpone ${id} not found for user ${userId}`,
      );
    }

    await this.postponeRepository.remove(postpone);
    this.logger.log(`Cancelled postpone ${id} for user ${userId}`);

    return { success: true };
  }

  /**
   * Process all ready-to-send postpones
   * This method is called by the cron job
   */
  async processReadyPostpones(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const postpones = await this.findReadyToSend();
    
    if (postpones.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.logger.log(`Processing ${postpones.length} ready postpone(s)`);

    let succeeded = 0;
    let failed = 0;

    for (const postpone of postpones) {
      try {
        // Re-send the notification to all user devices
        await this.pushOrchestrator.resendNotification(
          postpone.notification,
          postpone.user.id,
        );

        // Delete the postpone entry after successful send
        await this.postponeRepository.remove(postpone);
        succeeded++;
        
        this.logger.log(
          `Successfully re-sent notification ${postpone.notificationId} and removed postpone ${postpone.id}`,
        );
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to re-send notification ${postpone.notificationId} from postpone ${postpone.id}`,
          error,
        );
        // Keep the postpone entry so it can be retried next time
      }
    }

    this.logger.log(
      `Postpone processing completed: ${succeeded} succeeded, ${failed} failed`,
    );

    return {
      processed: postpones.length,
      succeeded,
      failed,
    };
  }

  /**
   * Check if a message has any pending postpones
   */
  async hasPendingPostpones(messageId: string): Promise<boolean> {
    const count = await this.postponeRepository.count({
      where: { messageId },
    });
    return count > 0;
  }

  /**
   * Count pending postpones for a specific message
   */
  async countPendingByMessage(messageId: string): Promise<number> {
    return this.postponeRepository.count({
      where: { messageId },
    });
  }
}
