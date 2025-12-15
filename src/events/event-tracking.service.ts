import { Injectable } from '@nestjs/common';
import { EventType } from '../entities';
import { EventsService } from './events.service';

@Injectable()
export class EventTrackingService {
  constructor(private readonly eventsService: EventsService) { }

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

  async trackPushPassthrough(
    systemTokenId: string,
    metadata?: any,
  ): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.PUSH_PASSTHROUGH,
      objectId: systemTokenId,
      additionalInfo: metadata,
    });
  }

  async trackPushPassthroughFailed(
    systemTokenId: string,
    metadata?: any,
  ): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.PUSH_PASSTHROUGH_FAILED,
      objectId: systemTokenId,
      additionalInfo: metadata
    });
  }

  async trackMessage(userId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.MESSAGE,
      userId,
    });
  }

  async trackNotification(
    userId: string,
    deviceId: string,
    notificationId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.NOTIFICATION,
      userId,
      objectId: notificationId,
      targetId: deviceId,
      // Notification tracking now relies entirely on the provided metadata
      // object. Callers are responsible for building the meta payload
      // (e.g. { platform, sentWith, availableMethods }).
      additionalInfo:
        metadata && Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }

  async trackNotificationFailed(
    userId: string,
    deviceId: string,
    notificationId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.NOTIFICATION_FAILED,
      userId,
      objectId: notificationId,
      targetId: deviceId,
      // Failed notification tracking also uses only the externally provided
      // metadata object so that callers have full control over what is
      // persisted (e.g. platform, sentWith, availableMethods).
      additionalInfo:
        metadata && Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }

  async trackNotificationAck(
    userId: string,
    deviceId: string,
    notificationId: string,
    platform?: string,
  ): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.NOTIFICATION_ACK,
      userId,
      objectId: notificationId,
      targetId: deviceId,
      additionalInfo: platform ? { platform } : undefined,
    });
  }

  async trackBucketCreation(userId: string, bucketId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.BUCKET_CREATION,
      userId,
      objectId: bucketId,
    });
  }

  async trackBucketSharing(
    ownerUserId: string,
    bucketId: string,
    sharedWithUserId: string,
  ): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.BUCKET_SHARING,
      userId: ownerUserId,
      objectId: bucketId,
      targetId: sharedWithUserId,
    });
  }

  async trackBucketUnsharing(
    ownerUserId: string,
    bucketId: string,
    unsharedFromUserId: string,
  ): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.BUCKET_UNSHARING,
      userId: ownerUserId,
      objectId: bucketId,
      targetId: unsharedFromUserId,
    });
  }

  async trackBucketDeletion(ownerUserId: string, bucketId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.BUCKET_DELETION,
      userId: ownerUserId,
      objectId: bucketId,
    });
  }

  async trackDeviceRegister(userId: string, deviceId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.DEVICE_REGISTER,
      userId,
      targetId: deviceId,
    });
  }

  async trackDeviceUnregister(userId: string, deviceId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.DEVICE_UNREGISTER,
      userId,
      targetId: deviceId,
    });
  }

  async trackAccountDelete(userId: string): Promise<void> {
    await this.eventsService.createEvent({
      type: EventType.ACCOUNT_DELETE,
      userId,
    });
  }

  async trackEmailSent(
    to: string,
    subject?: string,
    provider?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const additionalInfo: Record<string, any> = {
      to,
      ...(subject ? { subject } : {}),
      ...(provider ? { provider } : {}),
      ...(metadata || {}),
    };

    await this.eventsService.createEvent({
      type: EventType.EMAIL_SENT,
      additionalInfo,
    });
  }

  async trackEmailFailed(
    to: string,
    subject?: string,
    provider?: string,
    error?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const additionalInfo: Record<string, any> = {
      to,
      ...(subject ? { subject } : {}),
      ...(provider ? { provider } : {}),
      ...(error ? { error } : {}),
      ...(metadata || {}),
    };

    await this.eventsService.createEvent({
      type: EventType.EMAIL_FAILED,
      additionalInfo,
    });
  }
}
