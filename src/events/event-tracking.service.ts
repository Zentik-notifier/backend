import { Injectable } from '@nestjs/common';
import { EventType } from '../entities';
import { EventsService } from './events.service';

@Injectable()
export class EventTrackingService {
  constructor(private readonly eventsService: EventsService) {}

  async trackLogin(userId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.LOGIN,
      userId,
    });
  }

  async trackLoginOauth(userId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.LOGIN_OAUTH,
      userId,
    });
  }

  async trackLogout(userId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.LOGOUT,
      userId,
    });
  }

  async trackRegister(userId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.REGISTER,
      userId,
    });
  }

  async trackPushPassthrough(systemTokenId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.PUSH_PASSTHROUGH,
      objectId: systemTokenId,
    });
  }

  async trackMessage(userId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.MESSAGE,
      userId,
    });
  }

  async trackNotification(userId: string, deviceId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.NOTIFICATION,
      userId,
      objectId: deviceId,
    });
  }

  async trackBucketSharing(userId: string, bucketId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.BUCKET_SHARING,
      userId,
      objectId: bucketId,
    });
  }

  async trackBucketUnsharing(userId: string, bucketId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.BUCKET_UNSHARING,
      userId,
      objectId: bucketId,
    });
  }

  async trackDeviceRegister(userId: string, deviceId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.DEVICE_REGISTER,
      userId,
      objectId: deviceId,
    });
  }

  async trackDeviceUnregister(userId: string, deviceId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.DEVICE_UNREGISTER,
      userId,
      objectId: deviceId,
    });
  }

  async trackAccountDelete(userId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.ACCOUNT_DELETE,
      userId,
    });
  }
}
