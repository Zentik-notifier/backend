import { Injectable } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

export enum SubscriptionEvents {
  NOTIFICATION_CREATED = 'notificationCreated',
  NOTIFICATION_UPDATED = 'notificationUpdated',
  NOTIFICATION_DELETED = 'notificationDeleted',
  MESSAGE_CREATED = 'messageCreated',
  MESSAGE_DELETED = 'messageDeleted',
  BUCKET_CREATED = 'bucketCreated',
  BUCKET_UPDATED = 'bucketUpdated',
  BUCKET_DELETED = 'bucketDeleted',
  USER_BUCKET_UPDATED = 'userBucketUpdated',
  ENTITY_PERMISSION_UPDATED = 'entityPermissionUpdated',
  USER_PROFILE_UPDATED = 'userProfileUpdated',
  USER_PASSWORD_CHANGED = 'userPasswordChanged',
}

@Injectable()
export class GraphQLSubscriptionService {
  private pubSub = new PubSub();

  async publishNotificationCreated(notification: any, userId: string) {
    await this.pubSub.publish(SubscriptionEvents.NOTIFICATION_CREATED, {
      notificationCreated: notification,
      userId,
    });
  }

  async publishMessageCreated(message: any, userId: string) {
    await this.pubSub.publish(SubscriptionEvents.MESSAGE_CREATED, {
      messageCreated: message,
      newMessagesForUser: message,
      userId,
    });
  }

  async publishNotificationUpdated(notification: any, userId: string) {
    await this.pubSub.publish(SubscriptionEvents.NOTIFICATION_UPDATED, {
      notificationUpdated: notification,
      userId,
    });
  }

  async publishNotificationDeleted(notificationId: string, userId: string) {
    await this.pubSub.publish(SubscriptionEvents.NOTIFICATION_DELETED, {
      notificationDeleted: { id: notificationId },
      userId,
    });
  }

  async publishMessageDeleted(messageId: string, userId: string) {
    await this.pubSub.publish(SubscriptionEvents.MESSAGE_DELETED, {
      messageDeleted: messageId,
      userId,
    });
  }

  async publishBucketCreated(bucket: any, userId: string) {
    await this.pubSub.publish(SubscriptionEvents.BUCKET_CREATED, {
      bucketCreated: bucket,
      userId,
    });
  }

  async publishBucketUpdated(bucket: any, userId: string) {
    // Publish to the user who made the update
    await this.pubSub.publish(SubscriptionEvents.BUCKET_UPDATED, {
      bucketUpdated: bucket,
      userId,
    });
  }

  async publishBucketUpdatedToAllUsers(
    bucket: any,
    userId: string,
    allUserIds: string[],
  ) {
    // Publish to all users who have access to this bucket
    for (const targetUserId of allUserIds) {
      await this.pubSub.publish(SubscriptionEvents.BUCKET_UPDATED, {
        bucketUpdated: bucket,
        userId: targetUserId,
      });
    }
  }

  async publishBucketDeleted(bucketId: string, userId: string) {
    await this.pubSub.publish(SubscriptionEvents.BUCKET_DELETED, {
      bucketDeleted: bucketId,
      userId,
    });
  }

  async publishUserBucketUpdated(
    userBucket: any,
    bucketId: string,
    userId: string,
  ) {
    await this.pubSub.publish(SubscriptionEvents.USER_BUCKET_UPDATED, {
      userBucketUpdated: userBucket,
      bucketId,
      userId,
    });
  }

  async publishEntityPermissionUpdated(
    permission: any,
    bucketId: string,
    userId: string,
  ) {
    await this.pubSub.publish(SubscriptionEvents.ENTITY_PERMISSION_UPDATED, {
      entityPermissionUpdated: permission,
      bucketId,
      userId,
    });
  }

  // Subscription methods
  notificationCreated() {
    return this.pubSub.asyncIterableIterator(
      SubscriptionEvents.NOTIFICATION_CREATED,
    );
  }

  notificationUpdated() {
    return this.pubSub.asyncIterableIterator(
      SubscriptionEvents.NOTIFICATION_UPDATED,
    );
  }

  notificationDeleted() {
    return this.pubSub.asyncIterableIterator(
      SubscriptionEvents.NOTIFICATION_DELETED,
    );
  }

  messageCreated() {
    return this.pubSub.asyncIterableIterator(
      SubscriptionEvents.MESSAGE_CREATED,
    );
  }

  messageDeleted() {
    return this.pubSub.asyncIterableIterator(
      SubscriptionEvents.MESSAGE_DELETED,
    );
  }

  bucketCreated() {
    return this.pubSub.asyncIterableIterator(SubscriptionEvents.BUCKET_CREATED);
  }

  bucketUpdated() {
    return this.pubSub.asyncIterableIterator(SubscriptionEvents.BUCKET_UPDATED);
  }

  bucketDeleted() {
    return this.pubSub.asyncIterableIterator(SubscriptionEvents.BUCKET_DELETED);
  }

  userBucketUpdated() {
    return this.pubSub.asyncIterableIterator(
      SubscriptionEvents.USER_BUCKET_UPDATED,
    );
  }

  entityPermissionUpdated() {
    return this.pubSub.asyncIterableIterator(
      SubscriptionEvents.ENTITY_PERMISSION_UPDATED,
    );
  }

  // User subscription events
  async publishUserProfileUpdated(user: any, userId: string) {
    await this.pubSub.publish(SubscriptionEvents.USER_PROFILE_UPDATED, {
      userProfileUpdated: user,
      userId,
    });
  }

  async publishUserPasswordChanged(userId: string) {
    await this.pubSub.publish(SubscriptionEvents.USER_PASSWORD_CHANGED, {
      userPasswordChanged: true,
      userId,
    });
  }

  userProfileUpdated() {
    return this.pubSub.asyncIterableIterator(
      SubscriptionEvents.USER_PROFILE_UPDATED,
    );
  }

  userPasswordChanged() {
    return this.pubSub.asyncIterableIterator(
      SubscriptionEvents.USER_PASSWORD_CHANGED,
    );
  }
}
