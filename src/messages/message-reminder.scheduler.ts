import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MessageReminderService } from './message-reminder.service';
import { MessagesService } from './messages.service';
import { PushNotificationOrchestratorService } from '../notifications/push-orchestrator.service';

@Injectable()
export class MessageReminderScheduler {
  private readonly logger = new Logger(MessageReminderScheduler.name);

  constructor(
    private readonly reminderService: MessageReminderService,
    private readonly pushOrchestrator: PushNotificationOrchestratorService,
    private readonly messagesService: MessagesService,
  ) {
    this.logger.log('Message reminder scheduler initialized');
  }

  /**
   * Process ready reminders every minute
   */
  @Cron('*/1 * * * *')
  async handleReminders() {
    try {
      const scheduledResult = await this.messagesService.processScheduledSends();
      if (scheduledResult.processed > 0 || scheduledResult.failed > 0) {
        this.logger.log(
          `Scheduled sends: ${scheduledResult.processed} processed, ${scheduledResult.failed} failed`,
        );
      }

      const notifications = await this.reminderService.getUnreadNotificationsToRemind();

      if (notifications.length === 0) {
        // Still process to update counters and remove max-reached reminders
        await this.reminderService.processReadyReminders();
        return;
      }

      this.logger.log(
        `Processing ${notifications.length} unread notification(s) for reminders`,
      );

      let succeeded = 0;
      let failed = 0;

      // Resend each unread notification with reminder prefix
      for (const notification of notifications) {
        try {
          const result = await this.pushOrchestrator.resendNotificationAsReminder(
            notification,
            notification.userId,
          );
          
          if (result.success) {
            succeeded++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
          this.logger.error(
            `Failed to send reminder for notification ${notification.id}`,
            error,
          );
        }
      }

      this.logger.log(
        `Reminder notifications sent: ${succeeded} succeeded, ${failed} failed`,
      );

      // Update reminder counters and schedule next reminders
      const result = await this.reminderService.processReadyReminders();
      
      if (result.processed > 0) {
        this.logger.log(
          `Reminder processing completed: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed, ${result.maxReached} max reached`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to process message reminders', error);
    }

    // this.logger.debug('Cron completed: process message reminders');
  }
}
