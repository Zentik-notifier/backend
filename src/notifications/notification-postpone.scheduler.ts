import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationPostponeService } from './notification-postpone.service';

@Injectable()
export class NotificationPostponeScheduler {
  private readonly logger = new Logger(NotificationPostponeScheduler.name);

  constructor(
    private readonly postponeService: NotificationPostponeService,
  ) {
    this.logger.log('Notification postpone scheduler initialized');
  }

  /**
   * Process ready postpones every minute
   */
  @Cron('*/1 * * * *')
  async handlePostpones() {
    // this.logger.debug('Cron started: process notification postpones');

    try {
      const result = await this.postponeService.processReadyPostpones();
      
      if (result.processed > 0) {
        this.logger.log(
          `Postpone processing completed: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to process notification postpones', error);
    }

    // this.logger.debug('Cron completed: process notification postpones');
  }
}
