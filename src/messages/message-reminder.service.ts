import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { MessageReminder } from '../entities/message-reminder.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class MessageReminderService {
  private readonly logger = new Logger(MessageReminderService.name);

  constructor(
    @InjectRepository(MessageReminder)
    private readonly reminderRepository: Repository<MessageReminder>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Create a reminder entry for a message
   */
  async createReminder(
    messageId: string,
    userId: string,
    remindEveryMinutes: number,
    maxReminders: number = 5,
  ): Promise<MessageReminder> {
    const nextReminderAt = new Date();
    nextReminderAt.setMinutes(nextReminderAt.getMinutes() + remindEveryMinutes);

    const reminder = this.reminderRepository.create({
      messageId,
      userId,
      remindEveryMinutes,
      maxReminders,
      remindersSent: 0,
      nextReminderAt,
    });

    const saved = await this.reminderRepository.save(reminder);
    this.logger.log(
      `Created reminder ${saved.id} for message ${messageId}, next reminder at ${nextReminderAt.toISOString()}`,
    );

    return saved;
  }

  /**
   * Find all reminders that are ready to be sent
   */
  async findReadyToSend(): Promise<MessageReminder[]> {
    const now = new Date();
    return this.reminderRepository.find({
      where: {
        nextReminderAt: LessThanOrEqual(now),
      },
      relations: ['message', 'message.bucket', 'user'],
    });
  }

  /**
   * Process all ready-to-send reminders
   * This method is called by the cron job
   * Returns the push orchestrator service to trigger notification resend
   */
  async processReadyReminders(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    maxReached: number;
  }> {
    const reminders = await this.findReadyToSend();

    if (reminders.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, maxReached: 0 };
    }

    this.logger.log(`Processing ${reminders.length} ready reminder(s)`);

    let succeeded = 0;
    let failed = 0;
    let maxReached = 0;

    for (const reminder of reminders) {
      try {
        // Check if max reminders reached
        if (reminder.remindersSent >= reminder.maxReminders) {
          this.logger.log(
            `Reminder ${reminder.id} has reached max reminders (${reminder.maxReminders}), removing`,
          );
          await this.reminderRepository.remove(reminder);
          maxReached++;
          continue;
        }

        // Increment counter
        reminder.remindersSent += 1;

        // Calculate next reminder time
        const nextReminderAt = new Date();
        nextReminderAt.setMinutes(
          nextReminderAt.getMinutes() + reminder.remindEveryMinutes,
        );
        reminder.nextReminderAt = nextReminderAt;

        // Save updated reminder
        await this.reminderRepository.save(reminder);

        succeeded++;
        this.logger.log(
          `Updated reminder ${reminder.id}: sent ${reminder.remindersSent}/${reminder.maxReminders}, next at ${nextReminderAt.toISOString()}`,
        );
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to process reminder ${reminder.id} for message ${reminder.messageId}`,
          error,
        );
      }
    }

    this.logger.log(
      `Reminder processing completed: ${succeeded} succeeded, ${failed} failed, ${maxReached} max reached`,
    );

    return {
      processed: reminders.length,
      succeeded,
      failed,
      maxReached,
    };
  }

  /**
   * Cancel all reminders for a specific message
   */
  async cancelRemindersByMessage(messageId: string): Promise<number> {
    const reminders = await this.reminderRepository.find({
      where: { messageId },
    });

    if (reminders.length === 0) {
      return 0;
    }

    await this.reminderRepository.remove(reminders);
    this.logger.log(
      `Cancelled ${reminders.length} reminder(s) for message ${messageId}`,
    );

    return reminders.length;
  }

  /**
   * Cancel all reminders for a specific message and user
   */
  async cancelRemindersByMessageAndUser(
    messageId: string,
    userId: string,
  ): Promise<number> {
    const reminders = await this.reminderRepository.find({
      where: { messageId, userId },
    });

    if (reminders.length === 0) {
      return 0;
    }

    await this.reminderRepository.remove(reminders);
    this.logger.log(
      `Cancelled ${reminders.length} reminder(s) for message ${messageId} and user ${userId}`,
    );

    return reminders.length;
  }

  /**
   * Check if a message has any active reminders
   */
  async hasActiveReminders(messageId: string): Promise<boolean> {
    const count = await this.reminderRepository.count({
      where: { messageId },
    });
    return count > 0;
  }

  /**
   * Count active reminders for a specific message
   */
  async countActiveByMessage(messageId: string): Promise<number> {
    return this.reminderRepository.count({
      where: { messageId },
    });
  }

  /**
   * Get all active reminders for a user
   */
  async findByUser(userId: string): Promise<MessageReminder[]> {
    return this.reminderRepository.find({
      where: { userId },
      relations: ['message', 'message.bucket'],
      order: { nextReminderAt: 'ASC' },
    });
  }

  /**
   * Get unread notifications that need reminder
   * Returns only notifications that haven't been read yet
   */
  async getUnreadNotificationsToRemind(): Promise<Notification[]> {
    const reminders = await this.findReadyToSend();
    
    if (reminders.length === 0) {
      return [];
    }

    // Get user IDs from reminders
    const remindersByUser = new Map<string, MessageReminder[]>();
    for (const reminder of reminders) {
      const existing = remindersByUser.get(reminder.userId) || [];
      existing.push(reminder);
      remindersByUser.set(reminder.userId, existing);
    }

    // For each user, find their unread notifications for the reminder messages
    const allUnreadNotifications: Notification[] = [];
    
    for (const [userId, userReminders] of remindersByUser.entries()) {
      const messageIds = userReminders.map(r => r.messageId);
      
      // Find unread notifications for this user and these messages
      const unreadNotifications = await this.notificationRepository.find({
        where: messageIds.map(messageId => ({
          message: { id: messageId },
          userId,
          readAt: null as any, // Only unread notifications
        })),
        relations: ['message', 'message.bucket', 'user', 'userDevice'],
      });
      
      allUnreadNotifications.push(...unreadNotifications);
    }

    this.logger.log(
      `Found ${allUnreadNotifications.length} unread notification(s) to remind from ${reminders.length} reminder(s)`,
    );

    return allUnreadNotifications;
  }
}
