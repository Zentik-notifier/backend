import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Permission, ResourceType } from 'src/auth/dto/auth.dto';
import { DataSource } from 'typeorm';
import { Bucket } from '../entities/bucket.entity';
import { EntityPermission } from '../entities/entity-permission.entity';
import { Notification } from '../entities/notification.entity';
import { HttpMethod, UserWebhook } from '../entities/user-webhook.entity';
import { User } from '../entities/user.entity';
import {
  MediaType,
  NotificationActionType,
  NotificationDeliveryType,
} from '../notifications/notifications.types';
import { UserRole } from '../users/users.types';

export async function initializeDatabase(dataSource: DataSource) {
  const logger = new Logger('DatabaseInitSeed');
  logger.log('🌱 Starting comprehensive database initialization...');

  const notificationRepo = dataSource.getRepository(Notification);
  const bucketRepo = dataSource.getRepository(Bucket);
  const userRepo = dataSource.getRepository(User);
  const entityPermissionRepo = dataSource.getRepository(EntityPermission);

  // Create Admin User
  let adminUser = userRepo.create({
    firstName: 'Admin',
    lastName: 'Administrator',
    email: 'admin@zentik.com',
    password: await bcrypt.hash('admin', 12),
    username: 'apocaliss92',
    role: UserRole.ADMIN,
  });
  adminUser = await userRepo.save(adminUser);
  logger.log('✅ Admin user ready:', adminUser.email);

  // Create User1
  const user1 = userRepo.create({
    firstName: 'John',
    lastName: 'Doe',
    email: 'user1@zentik.com',
    password: await bcrypt.hash('user1', 12),
    username: 'user1',
    role: UserRole.USER,
  });
  await userRepo.save(user1);
  logger.log('✅ User1 created:', user1.email);

  // Create User2
  const user2 = userRepo.create({
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'user2@zentik.com',
    password: await bcrypt.hash('user2', 12),
    username: 'user2',
    role: UserRole.USER,
  });
  await userRepo.save(user2);
  logger.log('✅ User2 created:', user2.email);

  // Create Buckets for Admin
  const adminBuckets = await bucketRepo.save([
    {
      name: 'System Alerts',
      description: 'System monitoring and alerts',
      color: '#e74c3c',
      icon: 'https://picsum.photos/id/100/200/200',
      user: adminUser,
    },
    {
      name: 'Admin Reports',
      description: 'Administrative reports and analytics',
      color: '#27ae60',
      icon: 'https://picsum.photos/id/101/200/200',
      user: adminUser,
    },
    {
      name: 'Security',
      description: 'Security notifications',
      color: '#f39c12',
      icon: 'https://picsum.photos/id/107/200/200',
      user: adminUser,
    },
  ]);
  logger.log('✅ Admin buckets created:', adminBuckets.length);

  // Create Buckets for User1
  const user1Buckets = await bucketRepo.save([
    {
      name: 'Personal',
      description: 'Personal notifications',
      color: '#3498db',
      icon: 'https://picsum.photos/id/102/200/200',
      user: user1,
    },
    {
      name: 'Shared Read Only',
      description: 'Read-only shared bucket',
      color: '#95a5a6',
      icon: 'https://picsum.photos/id/108/200/200',
      user: user1,
    },
    {
      name: 'Shared ReadWrite',
      description: 'Work-related project updates (shared with READ/WRITE)',
      color: '#9b59b6',
      icon: 'https://picsum.photos/id/103/200/200',
      user: user1,
    },
    {
      name: 'Shared ReadWriteDelete',
      description: 'Collaborative workspace (shared with READ/WRITE/DELETE)',
      color: '#e67e22',
      icon: 'https://picsum.photos/id/109/200/200',
      user: user1,
    },
    {
      name: 'Shared Admin',
      description: 'Full access shared bucket (shared with ADMIN)',
      color: '#c0392b',
      icon: 'https://picsum.photos/id/110/200/200',
      user: user1,
    },
    {
      name: 'Important',
      description: 'Important alerts and reminders',
      color: '#e74c3c',
      icon: 'https://picsum.photos/id/104/200/200',
      user: user1,
    },
  ]);
  logger.log('✅ User1 buckets created:', user1Buckets.length);

  // Create Buckets for User2
  const user2Buckets = await bucketRepo.save([
    {
      name: 'Team Updates',
      description: 'Team communication and updates',
      color: '#2ecc71',
      icon: 'https://picsum.photos/id/105/200/200',
      user: user2,
    },
    {
      name: 'Shared ReadWriteDelete',
      description: 'Development notifications (shared with READ/WRITE/DELETE)',
      color: '#34495e',
      icon: 'https://picsum.photos/id/111/200/200',
      user: user2,
    },
    {
      name: 'Shared Admin',
      description:
        'Collaborative project notifications (shared with ADMIN permissions)',
      color: '#f39c12',
      icon: 'https://picsum.photos/id/106/200/200',
      user: user2,
    },
  ]);
  logger.log('✅ User2 buckets created:', user2Buckets.length);

  // Log that all buckets now have icons
  logger.log(
    '🎨 All buckets now have unique icons for better visual identification',
  );

  // Create Test Webhooks for all users
  const adminWebhooks = await dataSource.getRepository(UserWebhook).save([
    {
      name: 'Security Alert API',
      method: HttpMethod.POST,
      url: 'https://security-api.example.com/alert',
      headers: [
        { key: 'Authorization', value: 'Bearer admin-token-123' },
        { key: 'X-Source', value: 'zentik-admin' },
      ],
      user: adminUser,
    },
    {
      name: 'Analytics Report API',
      method: HttpMethod.GET,
      url: 'https://analytics-api.example.com/reports',
      headers: [{ key: 'X-API-Key', value: 'analytics-key-456' }],
      user: adminUser,
    },
    {
      name: 'System Monitoring API',
      method: HttpMethod.PUT,
      url: 'https://monitoring-api.example.com/status',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'X-Monitor-Source', value: 'zentik' },
      ],
      user: adminUser,
    },
    {
      name: 'Admin Notification Handler',
      method: HttpMethod.POST,
      url: 'https://admin-handler.example.com/notifications',
      headers: [
        { key: 'Authorization', value: 'Bearer admin-handler-789' },
        { key: 'X-Priority', value: 'high' },
      ],
      user: adminUser,
    },
  ]);
  logger.log('✅ Admin webhooks created:', adminWebhooks.length);

  const user1Webhooks = await dataSource.getRepository(UserWebhook).save([
    {
      name: 'Project Management API',
      method: HttpMethod.POST,
      url: 'https://project-api.example.com/tasks',
      headers: [
        { key: 'Authorization', value: 'Bearer user1-project-token' },
        { key: 'X-User-ID', value: 'user1' },
      ],
      user: user1,
    },
    {
      name: 'Time Tracking API',
      method: HttpMethod.PUT,
      url: 'https://time-api.example.com/entries',
      headers: [{ key: 'X-API-Key', value: 'time-tracking-key' }],
      user: user1,
    },
    {
      name: 'Document API',
      method: HttpMethod.GET,
      url: 'https://docs-api.example.com/documents',
      headers: [{ key: 'Accept', value: 'application/json' }],
      user: user1,
    },
    {
      name: 'Task Completion Handler',
      method: HttpMethod.POST,
      url: 'https://task-api.example.com/complete',
      headers: [
        { key: 'Authorization', value: 'Bearer user1-task-token' },
        { key: 'X-Trigger', value: 'notification' },
      ],
      user: user1,
    },
  ]);
  logger.log('✅ User1 webhooks created:', user1Webhooks.length);

  const user2Webhooks = await dataSource.getRepository(UserWebhook).save([
    {
      name: 'GitHub Integration API',
      method: HttpMethod.POST,
      url: 'https://github-api.example.com/webhooks',
      headers: [
        { key: 'Authorization', value: 'token github-personal-token' },
        { key: 'X-GitHub-Event', value: 'notification' },
      ],
      user: user2,
    },
    {
      name: 'CI/CD Pipeline API',
      method: HttpMethod.GET,
      url: 'https://ci-api.example.com/builds',
      headers: [{ key: 'X-API-Token', value: 'ci-pipeline-token' }],
      user: user2,
    },
    {
      name: 'Team Chat API',
      method: HttpMethod.POST,
      url: 'https://chat-api.example.com/messages',
      headers: [
        { key: 'Authorization', value: 'Bearer chat-bot-token' },
        { key: 'X-Channel', value: 'notifications' },
      ],
      user: user2,
    },
    {
      name: 'Deploy Notification Handler',
      method: HttpMethod.POST,
      url: 'https://deploy-api.example.com/notify',
      headers: [
        { key: 'Authorization', value: 'Bearer deploy-token' },
        { key: 'X-Environment', value: 'production' },
      ],
      user: user2,
    },
    {
      name: 'Performance Monitor',
      method: HttpMethod.PUT,
      url: 'https://perf-api.example.com/metrics',
      headers: [
        { key: 'X-Metric-Source', value: 'zentik' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      user: user2,
    },
  ]);
  logger.log('✅ User2 webhooks created:', user2Webhooks.length);

  // Create Sharing Permissions
  // 1. User1 shares "Shared Read Only" bucket with User2 (READ only)
  const sharing1 = entityPermissionRepo.create({
    resourceType: ResourceType.BUCKET,
    resourceId: user1Buckets[1].id, // Shared Read Only bucket
    user: user2,
    grantedBy: user1,
    permissions: [Permission.READ],
  });
  await entityPermissionRepo.save(sharing1);
  logger.log('✅ User1 shared "Shared Read Only" with User2 (READ)');

  // 2. User1 shares "Shared ReadWrite" bucket with User2 (READ/WRITE)
  const sharing2 = entityPermissionRepo.create({
    resourceType: ResourceType.BUCKET,
    resourceId: user1Buckets[2].id, // Shared ReadWrite bucket
    user: user2,
    grantedBy: user1,
    permissions: [Permission.READ, Permission.WRITE],
  });
  await entityPermissionRepo.save(sharing2);
  logger.log('✅ User1 shared "Shared ReadWrite" with User2 (READ/WRITE)');

  // 3. User1 shares "Shared ReadWriteDelete" bucket with User2 (READ/WRITE/DELETE)
  const sharing3 = entityPermissionRepo.create({
    resourceType: ResourceType.BUCKET,
    resourceId: user1Buckets[3].id, // Shared ReadWriteDelete bucket
    user: user2,
    grantedBy: user1,
    permissions: [Permission.READ, Permission.WRITE, Permission.DELETE],
  });
  await entityPermissionRepo.save(sharing3);
  logger.log(
    '✅ User1 shared "Shared ReadWriteDelete" with User2 (READ/WRITE/DELETE)',
  );

  // 4. User1 shares "Shared Admin" bucket with User2 (ADMIN - all permissions)
  const sharing4 = entityPermissionRepo.create({
    resourceType: ResourceType.BUCKET,
    resourceId: user1Buckets[4].id, // Shared Admin bucket
    user: user2,
    grantedBy: user1,
    permissions: [
      Permission.READ,
      Permission.WRITE,
      Permission.DELETE,
      Permission.ADMIN,
    ],
  });
  await entityPermissionRepo.save(sharing4);
  logger.log(
    '✅ User1 shared "Shared Admin" with User2 (ADMIN - all permissions)',
  );

  // Sample media URLs for notifications
  const sampleImages = [
    'https://picsum.photos/id/1/800/600',
    'https://picsum.photos/id/10/800/600',
    'https://picsum.photos/id/20/800/600',
    'https://picsum.photos/id/30/800/600',
    'https://picsum.photos/id/40/800/600',
    'https://picsum.photos/id/50/800/600',
    'https://picsum.photos/id/60/800/600',
    'https://picsum.photos/id/70/800/600',
  ];

  const sampleVideos = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  ];

  const sampleGifs = [
    'https://media.giphy.com/media/WoWm8YzFQJg5i/giphy.gif',
    'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    'https://media.giphy.com/media/l1J9FiGxR61OcF2mI/giphy.gif',
  ];

  const sampleAudio = [
    'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    'https://www.soundjay.com/misc/sounds/notification-01.wav',
  ];

  // Create Notifications for Admin
  const adminNotifications = [
    {
      title: 'System Status Update',
      body: 'All systems are operating normally.',
      bucket: adminBuckets[0], // Has bucket icon - should auto-attach
      bucketId: adminBuckets[0].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'GET:https://monitoring-api.example.com/status',
          destructive: false,
          icon: 'sfsymbols:chart.bar',
          title: 'View Status',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://monitoring-api.example.com/alert/silence',
          destructive: false,
          icon: 'sfsymbols:bell.slash',
          title: 'Silence Alerts',
        },
      ],
    },
    {
      title: 'Test Auto-Attach Bucket Icon',
      body: 'This notification should automatically get the bucket icon attached.',
      bucket: adminBuckets[1], // Has bucket icon - should auto-attach
      bucketId: adminBuckets[1].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
    },
    {
      title: 'Monthly Report Available',
      body: 'The monthly analytics report is ready for review.',
      bucket: adminBuckets[1], // Has bucket icon but already has image attachment - should NOT auto-attach
      bucketId: adminBuckets[1].id,
      attachments: [
        {
          mediaType: MediaType.IMAGE,
          url: sampleImages[0],
          name: 'Report Preview',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://analytics-api.example.com/report/download',
          destructive: false,
          icon: 'sfsymbols:arrow.down.circle',
          title: 'Download Report',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'PUT:https://analytics-api.example.com/report/status/read',
          destructive: false,
          icon: 'sfsymbols:checkmark.circle',
          title: 'Mark as Read',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://analytics-api.example.com/report/share',
          destructive: false,
          icon: 'sfsymbols:square.and.arrow.up',
          title: 'Share Report',
        },
      ],
    },
    {
      title: 'Security Alert',
      body: 'Unusual login activity detected with manual actions.',
      bucket: adminBuckets[2], // Security bucket - no icon - should NOT auto-attach
      bucketId: adminBuckets[2].id,
      deliveryType: NotificationDeliveryType.CRITICAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://security-api.example.com/alert',
          destructive: false,
          icon: 'sfsymbols:webhook',
          title: 'Report Incident',
        },
        {
          type: NotificationActionType.NAVIGATE,
          value: 'https://security-dashboard.example.com',
          destructive: false,
          icon: 'sfsymbols:shield.fill',
          title: 'View Dashboard',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://security-api.example.com/alert/acknowledge',
          destructive: false,
          icon: 'sfsymbols:checkmark.shield',
          title: 'Acknowledge',
        },
      ],
      tapAction: {
        type: NotificationActionType.BACKGROUND_CALL,
        value:
          'GET:https://security-api.example.com/incident/{{notificationId}}',
        destructive: false,
        icon: 'sfsymbols:info.circle',
        title: 'Get Details',
      },
    },
    {
      title: 'Webhook Integration Test',
      body: 'Testing webhook integration capabilities with manual actions.',
      bucket: adminBuckets[1],
      bucketId: adminBuckets[1].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.WEBHOOK,
          value: adminWebhooks[0].id, // Security Alert API
          destructive: false,
          icon: 'sfsymbols:link',
          title: 'Trigger Webhook',
        },
        {
          type: NotificationActionType.MARK_AS_READ,
          value: 'clear',
          destructive: false,
          icon: 'sfsymbols:checkmark.circle',
          title: 'Mark as Read',
        },
      ],
    },
    {
      title: 'Reminder Notification',
      body: 'This is a reminder that can be snoozed with manual actions.',
      bucket: adminBuckets[2],
      bucketId: adminBuckets[2].id,
      deliveryType: NotificationDeliveryType.SILENT,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.SNOOZE,
          value: '30m',
          destructive: false,
          icon: 'sfsymbols:clock',
          title: 'Snooze 30 min',
        },
        {
          type: NotificationActionType.SNOOZE,
          value: '1h',
          destructive: false,
          icon: 'sfsymbols:clock.fill',
          title: 'Snooze 1 hour',
        },
        {
          type: NotificationActionType.MARK_AS_READ,
          value: 'clear',
          destructive: false,
          icon: 'sfsymbols:checkmark.circle',
          title: 'Dismiss',
        },
      ],
    },
    {
      title: 'Navigation Test',
      body: 'Testing navigation actions to external services with manual actions.',
      bucket: adminBuckets[0],
      bucketId: adminBuckets[0].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.NAVIGATE,
          value: 'https://zentik-docs.example.com',
          destructive: false,
          icon: 'sfsymbols:book',
          title: 'View Documentation',
        },
        {
          type: NotificationActionType.NAVIGATE,
          value: 'https://zentik-support.example.com',
          destructive: false,
          icon: 'sfsymbols:questionmark.circle',
          title: 'Get Support',
        },
        {
          type: NotificationActionType.OPEN_NOTIFICATION,
          value: 'default',
          destructive: false,
          icon: 'sfsymbols:eye',
          title: 'View Details',
        },
      ],
    },
    {
      title: 'Training Video Released',
      body: 'New security training video is now available.',
      bucket: adminBuckets[0],
      bucketId: adminBuckets[0].id,
      attachments: [
        {
          mediaType: MediaType.VIDEO,
          url: sampleVideos[0],
          name: 'Security Training',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://training-api.example.com/video/complete',
          destructive: false,
          icon: 'sfsymbols:play.circle',
          title: 'Mark as Watched',
        },
        {
          type: NotificationActionType.NAVIGATE,
          value: 'https://training.example.com/courses',
          destructive: false,
          icon: 'sfsymbols:book.fill',
          title: 'View Courses',
        },
      ],
    },
    {
      title: 'Automatic Actions Demo - Full Set',
      body: 'This notification demonstrates all automatic actions (mark as read, delete, open, snooze) with English locale.',
      bucket: adminBuckets[0],
      bucketId: adminBuckets[0].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      addMarkAsReadAction: true,
      addDeleteAction: true,
      addOpenNotificationAction: true,
      snoozes: [15, 30, 60],
      locale: 'en-EN',
    },
    {
      title: 'Demo Azioni Automatiche - Set Completo',
      body: 'Questa notifica dimostra tutte le azioni automatiche (segna come letta, elimina, apri, posticipa) con locale italiano.',
      bucket: adminBuckets[1],
      bucketId: adminBuckets[1].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      addMarkAsReadAction: true,
      addDeleteAction: true,
      addOpenNotificationAction: true,
      snoozes: [15, 30, 60],
      locale: 'it-IT',
    },
    {
      title: 'Mark as Read and Open Actions Only',
      body: 'Notification with only mark as read and open actions enabled.',
      bucket: adminBuckets[2],
      bucketId: adminBuckets[2].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      addMarkAsReadAction: true,
      addOpenNotificationAction: true,
      locale: 'en-EN',
    },
    {
      title: 'Snooze Actions Demo',
      body: 'Notification demonstrating various snooze options with automatic mark as read action.',
      bucket: adminBuckets[0],
      bucketId: adminBuckets[0].id,
      deliveryType: NotificationDeliveryType.SILENT,
      user: adminUser,
      addMarkAsReadAction: true,
      snoozes: [5, 15, 30, 60, 120],
      locale: 'en-EN',
    },
    {
      title: 'Delete Action Demo',
      body: 'Notification with delete action enabled for testing.',
      bucket: adminBuckets[1],
      bucketId: adminBuckets[1].id,
      deliveryType: NotificationDeliveryType.CRITICAL,
      user: adminUser,
      addDeleteAction: true,
      addOpenNotificationAction: true,
      locale: 'en-EN',
    },
    {
      title: 'Multiple Files Shared',
      body: 'Several important files have been shared with you with manual actions.',
      bucket: adminBuckets[1],
      bucketId: adminBuckets[1].id,
      attachments: [
        { mediaType: MediaType.IMAGE, url: sampleImages[1], name: 'Chart.jpg' },
        {
          mediaType: MediaType.VIDEO,
          url: sampleVideos[1],
          name: 'Presentation.mp4',
        },
        {
          mediaType: MediaType.GIF,
          url: sampleGifs[0],
          name: 'Celebration.gif',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://files-api.example.com/download/batch',
          destructive: false,
          icon: 'sfsymbols:arrow.down.doc',
          title: 'Download All',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'PUT:https://files-api.example.com/status/reviewed',
          destructive: false,
          icon: 'sfsymbols:eye',
          title: 'Mark as Reviewed',
        },
      ],
    },
    {
      title: 'Audio Notification Test',
      body: 'Please review the attached audio message with manual actions.',
      bucket: adminBuckets[2],
      bucketId: adminBuckets[2].id,
      attachments: [
        {
          mediaType: MediaType.AUDIO,
          url: sampleAudio[0],
          name: 'Audio_Message.wav',
        },
      ],
      deliveryType: NotificationDeliveryType.CRITICAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://audio-api.example.com/transcribe',
          destructive: false,
          icon: 'sfsymbols:text.bubble',
          title: 'Transcribe Audio',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value:
            'DELETE:https://audio-api.example.com/message/{{notificationId}}',
          destructive: true,
          icon: 'sfsymbols:trash',
          title: 'Delete Message',
        },
      ],
    },
    {
      title: 'Admin Webhook Test',
      body: 'Testing webhook integration with admin privileges.',
      bucket: adminBuckets[0],
      bucketId: adminBuckets[0].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.WEBHOOK,
          value: adminWebhooks[3].id, // Admin Notification Handler
          destructive: false,
          icon: 'sfsymbols:link',
          title: 'Execute Admin Webhook',
        },
        {
          type: NotificationActionType.MARK_AS_READ,
          value: 'clear',
          destructive: false,
          icon: 'sfsymbols:checkmark.circle',
          title: 'Mark as Read',
        },
      ],
    },
    {
      title: 'Admin Snooze Test',
      body: 'Testing snooze functionality with admin account.',
      bucket: adminBuckets[1],
      bucketId: adminBuckets[1].id,
      deliveryType: NotificationDeliveryType.SILENT,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.SNOOZE,
          value: '2h',
          destructive: false,
          icon: 'sfsymbols:clock',
          title: 'Snooze 2 hours',
        },
        {
          type: NotificationActionType.SNOOZE,
          value: '1d',
          destructive: false,
          icon: 'sfsymbols:calendar',
          title: 'Snooze 1 day',
        },
        {
          type: NotificationActionType.OPEN_NOTIFICATION,
          value: 'default',
          destructive: false,
          icon: 'sfsymbols:eye',
          title: 'View Details',
        },
      ],
    },
    {
      title: 'Database Backup Complete',
      body: 'Daily database backup has completed successfully.',
      bucket: adminBuckets[0],
      bucketId: adminBuckets[0].id,
      deliveryType: NotificationDeliveryType.SILENT,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'GET:https://backup-api.example.com/status',
          destructive: false,
          icon: 'sfsymbols:externaldrive',
          title: 'Check Status',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://backup-api.example.com/restore/test',
          destructive: false,
          icon: 'sfsymbols:arrow.clockwise',
          title: 'Test Restore',
        },
      ],
    },
    {
      title: 'User Registration Spike',
      body: 'Unusual increase in user registrations detected.',
      bucket: adminBuckets[1],
      bucketId: adminBuckets[1].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: adminUser,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://analytics-api.example.com/investigate',
          destructive: false,
          icon: 'sfsymbols:magnifyingglass',
          title: 'Investigate',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'PUT:https://security-api.example.com/threat-level/high',
          destructive: true,
          icon: 'sfsymbols:exclamationmark.triangle',
          title: 'Raise Threat Level',
        },
      ],
    },
  ];

  // for (const notifData of adminNotifications) {
  //   await notificationRepo.save(notificationRepo.create(notifData));
  // }
  // logger.log('✅ Admin notifications created:', adminNotifications.length);

  // Create Notifications for User1
  const user1Notifications = [
    {
      title: 'Welcome to Zentik',
      body: 'Your account has been successfully created.',
      bucket: user1Buckets[0], // Personal - has bucket icon - should auto-attach
      bucketId: user1Buckets[0].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
    },
    {
      title: 'Auto-Attach Test for User1',
      body: 'This notification should get the bucket icon automatically attached.',
      bucket: user1Buckets[5], // Important - has bucket icon - should auto-attach
      bucketId: user1Buckets[5].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
    },
    {
      title: 'Read Only Document',
      body: 'New documentation available for review.',
      bucket: user1Buckets[1], // Shared Read Only
      bucketId: user1Buckets[1].id,
      attachments: [
        {
          mediaType: MediaType.IMAGE,
          url: sampleImages[2],
          name: 'Documentation_Preview.jpg',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
    },
    {
      title: 'Project Assignment',
      body: 'You have been assigned to a new project.',
      bucket: user1Buckets[2], // Shared ReadWrite
      bucketId: user1Buckets[2].id,
      attachments: [
        {
          mediaType: MediaType.IMAGE,
          url: sampleImages[3],
          name: 'Project_Overview.jpg',
        },
        {
          mediaType: MediaType.VIDEO,
          url: sampleVideos[2],
          name: 'Project_Intro.mp4',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
    },
    {
      title: 'Task Completed',
      body: 'Your latest task has been marked as completed.',
      bucket: user1Buckets[3], // Shared ReadWriteDelete
      bucketId: user1Buckets[3].id,
      attachments: [
        { mediaType: MediaType.GIF, url: sampleGifs[1], name: 'Success.gif' },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
    },
    {
      title: 'Admin Access Granted',
      body: 'You now have full administrative access to this resource.',
      bucket: user1Buckets[4], // Shared Admin
      bucketId: user1Buckets[4].id,
      attachments: [
        {
          mediaType: MediaType.AUDIO,
          url: sampleAudio[1],
          name: 'Welcome_Admin.wav',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
    },
    {
      title: 'Deadline Reminder',
      body: 'Project deadline is approaching.',
      bucket: user1Buckets[5], // Important
      bucketId: user1Buckets[5].id,
      attachments: [
        {
          mediaType: MediaType.IMAGE,
          url: sampleImages[4],
          name: 'Timeline.jpg',
        },
        { mediaType: MediaType.GIF, url: sampleGifs[2], name: 'Urgent.gif' },
      ],
      deliveryType: NotificationDeliveryType.CRITICAL,
      user: user1,
    },
    {
      title: 'Mixed Media Collection',
      body: 'Complete media collection for your reference.',
      bucket: user1Buckets[0], // Personal
      bucketId: user1Buckets[0].id,
      attachments: [
        {
          mediaType: MediaType.IMAGE,
          url: sampleImages[5],
          name: 'Photo1.jpg',
        },
        {
          mediaType: MediaType.VIDEO,
          url: sampleVideos[3],
          name: 'Tutorial.mp4',
        },
        { mediaType: MediaType.GIF, url: sampleGifs[0], name: 'Animation.gif' },
        {
          mediaType: MediaType.AUDIO,
          url: sampleAudio[0],
          name: 'Notification.wav',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://media-api.example.com/collection/archive',
          destructive: false,
          icon: 'sfsymbols:archivebox',
          title: 'Archive Collection',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'PUT:https://media-api.example.com/collection/favorite',
          destructive: false,
          icon: 'sfsymbols:heart',
          title: 'Mark as Favorite',
        },
      ],
    },
    {
      title: 'Meeting Reminder',
      body: 'Team meeting starts in 15 minutes.',
      bucket: user1Buckets[0], // Personal
      bucketId: user1Buckets[0].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://calendar-api.example.com/meeting/join',
          destructive: false,
          icon: 'sfsymbols:video',
          title: 'Join Meeting',
        },
        {
          type: NotificationActionType.SNOOZE,
          value: '15m',
          destructive: false,
          icon: 'sfsymbols:clock',
          title: 'Remind in 15 min',
        },
      ],
    },
    {
      title: 'Webhook Test for User1',
      body: 'Testing webhook integration with user1 account.',
      bucket: user1Buckets[1],
      bucketId: user1Buckets[1].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
      actions: [
        {
          type: NotificationActionType.WEBHOOK,
          value: user1Webhooks[3].id, // Task Completion Handler
          destructive: false,
          icon: 'sfsymbols:link',
          title: 'Execute Webhook',
        },
        {
          type: NotificationActionType.NAVIGATE,
          value: 'https://webhook-docs.example.com',
          destructive: false,
          icon: 'sfsymbols:book',
          title: 'View Docs',
        },
      ],
    },
    {
      title: 'Clear Action Test',
      body: 'Testing clear action functionality.',
      bucket: user1Buckets[2],
      bucketId: user1Buckets[2].id,
      deliveryType: NotificationDeliveryType.SILENT,
      user: user1,
      actions: [
        {
          type: NotificationActionType.MARK_AS_READ,
          value: 'clear',
          destructive: false,
          icon: 'sfsymbols:checkmark.circle',
          title: 'Mark as Read',
        },
        {
          type: NotificationActionType.OPEN_NOTIFICATION,
          value: 'default',
          destructive: false,
          icon: 'sfsymbols:eye',
          title: 'View Details',
        },
      ],
    },
    {
      title: 'Meeting Snooze Test',
      body: 'Testing meeting snooze functionality.',
      bucket: user1Buckets[0],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'PUT:https://calendar-api.example.com/meeting/snooze',
          destructive: false,
          icon: 'sfsymbols:clock.badge.plus',
          title: 'Snooze 5min',
        },
      ],
    },
    {
      title: 'Invoice Payment Due',
      body: 'Invoice #INV-2024-001 is due in 3 days.',
      bucket: user1Buckets[5], // Important
      deliveryType: NotificationDeliveryType.CRITICAL,
      user: user1,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://billing-api.example.com/payment/process',
          destructive: false,
          icon: 'sfsymbols:creditcard',
          title: 'Pay Now',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'GET:https://billing-api.example.com/invoice/details',
          destructive: false,
          icon: 'sfsymbols:doc.text',
          title: 'View Details',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://billing-api.example.com/payment/reminder',
          destructive: false,
          icon: 'sfsymbols:bell',
          title: 'Set Reminder',
        },
      ],
    },
    {
      title: 'Project Webhook Integration',
      body: 'Testing project management and time tracking webhook integrations.',
      bucket: user1Buckets[2], // Shared ReadWrite
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
      actions: [
        {
          type: NotificationActionType.WEBHOOK,
          value: user1Webhooks[0].id, // Project Management API
          destructive: false,
          icon: 'sfsymbols:folder',
          title: 'Update Project',
        },
        {
          type: NotificationActionType.WEBHOOK,
          value: user1Webhooks[1].id, // Time Tracking API
          destructive: false,
          icon: 'sfsymbols:clock',
          title: 'Log Time',
        },
        {
          type: NotificationActionType.MARK_AS_READ,
          value: 'clear',
          destructive: false,
          icon: 'sfsymbols:checkmark.circle',
          title: 'Mark as Read',
        },
      ],
    },
    {
      title: 'Software Update Available',
      body: 'New version 2.1.0 is ready to install.',
      bucket: user1Buckets[0], // Personal
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://update-api.example.com/install',
          destructive: false,
          icon: 'sfsymbols:arrow.triangle.2.circlepath',
          title: 'Install Update',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'GET:https://update-api.example.com/changelog',
          destructive: false,
          icon: 'sfsymbols:list.bullet',
          title: 'View Changelog',
        },
      ],
    },
    {
      title: 'Social Media Mention',
      body: 'You were mentioned in a post by @techguru.',
      bucket: user1Buckets[0], // Personal
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
      actions: [
        {
          type: NotificationActionType.NAVIGATE,
          value: 'https://social.example.com/post/123',
          destructive: false,
          icon: 'sfsymbols:at',
          title: 'View Post',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://social-api.example.com/mention/reply',
          destructive: false,
          icon: 'sfsymbols:arrowshape.turn.up.left',
          title: 'Reply',
        },
      ],
    },
    {
      title: 'Personal Reminder with Auto Actions',
      body: 'Personal reminder with automatic mark as read and snooze actions.',
      bucket: user1Buckets[0], // Personal
      deliveryType: NotificationDeliveryType.SILENT,
      user: user1,
      addMarkAsReadAction: true,
      snoozes: [30, 60],
      locale: 'en-EN',
    },
    {
      title: 'Important Alert - Auto Delete',
      body: 'Important alert with automatic delete and open actions enabled.',
      bucket: user1Buckets[4], // Important bucket
      deliveryType: NotificationDeliveryType.CRITICAL,
      user: user1,
      addDeleteAction: true,
      addOpenNotificationAction: true,
      locale: 'en-EN',
    },
    {
      title: 'Work Project Update',
      body: 'Project status update with automatic mark as read, open and snooze actions.',
      bucket: user1Buckets[2], // Shared ReadWrite
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user1,
      addMarkAsReadAction: true,
      addOpenNotificationAction: true,
      snoozes: [15, 60],
      locale: 'en-EN',
    },
  ];

  // for (const notifData of user1Notifications) {
  //   await notificationRepo.save(notificationRepo.create(notifData));
  // }
  // logger.log('✅ User1 notifications created:', user1Notifications.length);

  // Create Notifications for User2
  const user2Notifications = [
    {
      title: 'Team Meeting Scheduled',
      body: 'Weekly team standup scheduled for tomorrow with automatic bucket icon attachment.',
      bucket: user2Buckets[0], // Team Updates - has bucket icon - should auto-attach
      bucketId: user2Buckets[0].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
    },
    {
      title: 'Bucket Icon Auto-Attach Test',
      body: 'Testing automatic bucket icon attachment for User2 with automatic actions.',
      bucket: user2Buckets[2], // Shared Admin - has bucket icon - should auto-attach
      bucketId: user2Buckets[2].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
    },
    {
      title: 'Code Review Required',
      body: 'New pull request requires your review with manual actions.',
      bucket: user2Buckets[1],
      bucketId: user2Buckets[1].id,
      attachments: [
        {
          mediaType: MediaType.VIDEO,
          url: sampleVideos[0],
          name: 'Code_Walkthrough.mp4',
        },
        {
          mediaType: MediaType.IMAGE,
          url: sampleImages[7],
          name: 'Code_Preview.jpg',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://github-api.example.com/pull-request/approve',
          destructive: false,
          icon: 'sfsymbols:checkmark.circle.fill',
          title: 'Approve PR',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://github-api.example.com/pull-request/comment',
          destructive: false,
          icon: 'sfsymbols:text.bubble',
          title: 'Add Comment',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value:
            'POST:https://github-api.example.com/pull-request/request-changes',
          destructive: true,
          icon: 'sfsymbols:xmark.circle',
          title: 'Request Changes',
        },
      ],
      tapAction: {
        type: NotificationActionType.NAVIGATE,
        value: 'https://github.com/zentik/pull/123',
        destructive: false,
        icon: 'sfsymbols:arrow.up.right.square',
        title: 'View PR',
      },
    },
    {
      title: 'Collaboration Request',
      body: 'User1 wants to collaborate on a project with manual actions.',
      bucket: user2Buckets[2],
      bucketId: user2Buckets[2].id,
      attachments: [
        { mediaType: MediaType.GIF, url: sampleGifs[1], name: 'Handshake.gif' },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
    },
    {
      title: 'Build Completed',
      body: 'Your latest build has completed successfully with manual actions.',
      bucket: user2Buckets[1],
      bucketId: user2Buckets[1].id,
      attachments: [
        {
          mediaType: MediaType.AUDIO,
          url: sampleAudio[0],
          name: 'Success_Sound.wav',
        },
      ],
      deliveryType: NotificationDeliveryType.SILENT,
      user: user2,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'GET:https://ci-api.example.com/build/{{buildId}}/artifacts',
          destructive: false,
          icon: 'sfsymbols:arrow.down.circle',
          title: 'Download Artifacts',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://ci-api.example.com/build/{{buildId}}/deploy',
          destructive: false,
          icon: 'sfsymbols:rocket',
          title: 'Deploy Build',
        },
      ],
      tapAction: {
        type: NotificationActionType.BACKGROUND_CALL,
        value: 'GET:https://ci-api.example.com/build/{{buildId}}/logs',
        destructive: false,
        icon: 'sfsymbols:doc.text',
        title: 'View Logs',
      },
    },
    {
      title: 'Webhook Integration Test for User2',
      body: 'Testing webhook integration with user2 account and manual actions.',
      bucket: user2Buckets[0],
      bucketId: user2Buckets[0].id,
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
      actions: [
        {
          type: NotificationActionType.WEBHOOK,
          value: user2Webhooks[3].id, // Deploy Notification Handler
          destructive: false,
          icon: 'sfsymbols:link',
          title: 'Trigger Webhook',
        },
        {
          type: NotificationActionType.MARK_AS_READ,
          value: 'clear',
          destructive: false,
          icon: 'sfsymbols:checkmark.circle',
          title: 'Mark as Read',
        },
      ],
    },
    {
      title: 'Snooze Test for User2',
      body: 'Testing snooze functionality with different durations and manual actions.',
      bucket: user2Buckets[2],
      deliveryType: NotificationDeliveryType.SILENT,
      user: user2,
      actions: [
        {
          type: NotificationActionType.SNOOZE,
          value: '1h',
          destructive: false,
          icon: 'sfsymbols:clock',
          title: 'Snooze 1 hour',
        },
        {
          type: NotificationActionType.SNOOZE,
          value: '4h',
          destructive: false,
          icon: 'sfsymbols:clock.fill',
          title: 'Snooze 4 hours',
        },
        {
          type: NotificationActionType.SNOOZE,
          value: '1d',
          destructive: false,
          icon: 'sfsymbols:calendar',
          title: 'Snooze 1 day',
        },
      ],
    },
    {
      title: 'Navigation Test for User2',
      body: 'Testing navigation actions to various external services with manual actions.',
      bucket: user2Buckets[1],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
      actions: [
        {
          type: NotificationActionType.NAVIGATE,
          value: 'https://github.com/zentik',
          destructive: false,
          icon: 'sfsymbols:github',
          title: 'View Repository',
        },
        {
          type: NotificationActionType.NAVIGATE,
          value: 'https://zentik-slack.example.com',
          destructive: false,
          icon: 'sfsymbols:message',
          title: 'Join Slack',
        },
        {
          type: NotificationActionType.OPEN_NOTIFICATION,
          value: 'default',
          destructive: false,
          icon: 'sfsymbols:eye',
          title: 'View Details',
        },
      ],
    },
    {
      title: 'Deploy to Staging',
      body: 'New build ready for staging deployment.',
      bucket: user2Buckets[1],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://ci-api.example.com/build/{{buildId}}/deploy',
          destructive: false,
          icon: 'sfsymbols:paperplane.circle',
          title: 'Deploy to Staging',
        },
      ],
      tapAction: {
        type: NotificationActionType.BACKGROUND_CALL,
        value: 'GET:https://ci-api.example.com/build/{{buildId}}/logs',
        destructive: false,
        icon: 'sfsymbols:doc.text',
        title: 'View Logs',
      },
    },
    {
      title: 'Performance Report',
      body: 'Weekly performance metrics are available.',
      bucket: user2Buckets[0],
      attachments: [
        {
          mediaType: MediaType.IMAGE,
          url: sampleImages[0],
          name: 'Performance_Chart.jpg',
        },
        {
          mediaType: MediaType.VIDEO,
          url: sampleVideos[1],
          name: 'Analysis_Video.mp4',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
    },
    {
      title: 'All Media Types Demo',
      body: 'Demonstration of all supported media types in one notification.',
      bucket: user2Buckets[2],
      attachments: [
        {
          mediaType: MediaType.IMAGE,
          url: sampleImages[1],
          name: 'Demo_Image.jpg',
        },
        {
          mediaType: MediaType.VIDEO,
          url: sampleVideos[2],
          name: 'Demo_Video.mp4',
        },
        {
          mediaType: MediaType.GIF,
          url: sampleGifs[2],
          name: 'Demo_Animation.gif',
        },
        {
          mediaType: MediaType.AUDIO,
          url: sampleAudio[1],
          name: 'Demo_Audio.wav',
        },
      ],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://media-api.example.com/demo/export',
          destructive: false,
          icon: 'sfsymbols:square.and.arrow.up',
          title: 'Export Demo',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'PUT:https://media-api.example.com/demo/rating',
          destructive: false,
          icon: 'sfsymbols:star',
          title: 'Rate Demo',
        },
      ],
    },
    {
      title: 'Pull Request Review Requested',
      body: 'New PR #456 needs your review for the authentication module.',
      bucket: user2Buckets[1],
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value:
            'POST:https://github-api.example.com/pull-request/review/request',
          destructive: false,
          icon: 'sfsymbols:eye',
          title: 'Start Review',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://github-api.example.com/pull-request/assign',
          destructive: false,
          icon: 'sfsymbols:person.badge.plus',
          title: 'Assign to Me',
        },
      ],
    },
    {
      title: 'Deployment Failed',
      body: 'Production deployment failed due to configuration error with manual actions.',
      bucket: user2Buckets[1],
      deliveryType: NotificationDeliveryType.CRITICAL,
      user: user2,
      actions: [
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'GET:https://ci-api.example.com/deployment/logs',
          destructive: false,
          icon: 'sfsymbols:doc.text',
          title: 'View Logs',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://ci-api.example.com/deployment/rollback',
          destructive: true,
          icon: 'sfsymbols:arrow.uturn.backward',
          title: 'Rollback',
        },
        {
          type: NotificationActionType.BACKGROUND_CALL,
          value: 'POST:https://ci-api.example.com/deployment/retry',
          destructive: false,
          icon: 'sfsymbols:arrow.clockwise',
          title: 'Retry Deployment',
        },
      ],
    },
    {
      title: 'Team Standup Reminder',
      body: 'Daily team standup in 15 minutes with automatic mark as read, open and snooze actions.',
      bucket: user2Buckets[0], // Team Updates
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
      addMarkAsReadAction: true,
      addOpenNotificationAction: true,
      snoozes: [15, 30],
      locale: 'en-EN',
    },
    {
      title: 'Code Review Deadline',
      body: 'Code review deadline approaching with automatic delete, open and snooze actions.',
      bucket: user2Buckets[1], // Shared ReadWriteDelete
      deliveryType: NotificationDeliveryType.CRITICAL,
      user: user2,
      addDeleteAction: true,
      addOpenNotificationAction: true,
      snoozes: [60, 120],
      locale: 'en-EN',
    },
    {
      title: 'Collaborative Project Update',
      body: 'Project update with automatic mark as read, delete, open and snooze actions for team collaboration.',
      bucket: user2Buckets[2], // Shared Admin
      deliveryType: NotificationDeliveryType.NORMAL,
      user: user2,
      addMarkAsReadAction: true,
      addDeleteAction: true,
      addOpenNotificationAction: true,
      snoozes: [30, 60, 120],
      locale: 'en-EN',
    },
  ];

  // for (const notifData of user2Notifications) {
  //   await notificationRepo.save(notificationRepo.create(notifData));
  // }
  // logger.log('✅ User2 notifications created:', user2Notifications.length);

  // Log sharing summary for testing reference
  logger.log('\n� WEBHOOK SUMMARY FOR TESTING:');
  logger.log('=================================');
  logger.log(`👤 Admin (${adminUser.email}):`);
  adminWebhooks.forEach((webhook, index) => {
    logger.log(
      `   ${index}: ${webhook.name} (${webhook.method}) - ID: ${webhook.id}`,
    );
  });

  logger.log(`\n👤 User1 (${user1.email}):`);
  user1Webhooks.forEach((webhook, index) => {
    logger.log(
      `   ${index}: ${webhook.name} (${webhook.method}) - ID: ${webhook.id}`,
    );
  });

  logger.log(`\n👤 User2 (${user2.email}):`);
  user2Webhooks.forEach((webhook, index) => {
    logger.log(
      `   ${index}: ${webhook.name} (${webhook.method}) - ID: ${webhook.id}`,
    );
  });

  logger.log('\n�📋 SHARING SUMMARY FOR TESTING:');
  logger.log('=================================');
  logger.log(`👤 User1 (${user1.email}):`);
  logger.log(`   • Owns: ${user1Buckets.map((b) => b.name).join(', ')}`);
  logger.log(`   • Shares with User2:`);
  logger.log(`     - "Shared Read Only" → READ`);
  logger.log(`     - "Shared ReadWrite" → READ/WRITE`);
  logger.log(`     - "Shared ReadWriteDelete" → READ/WRITE/DELETE`);
  logger.log(`     - "Shared Admin" → READ/WRITE/DELETE/ADMIN`);

  logger.log(`\n👤 User2 (${user2.email}):`);
  logger.log(`   • Owns: ${user2Buckets.map((b) => b.name).join(', ')}`);
  logger.log(`   • Has access to User1's buckets:`);
  logger.log(`     - "Shared Read Only" (READ)`);
  logger.log(`     - "Shared ReadWrite" (READ/WRITE)`);
  logger.log(`     - "Shared ReadWriteDelete" (READ/WRITE/DELETE)`);
  logger.log(`     - "Shared Admin" (READ/WRITE/DELETE/ADMIN)`);

  logger.log(`\n👤 Admin (${adminUser.email}):`);
  logger.log(`   • Owns: ${adminBuckets.map((b) => b.name).join(', ')}`);
  logger.log(`   • No sharing (admin has global access)`);

  logger.log('\n🧪 PERMISSION TESTING SCENARIOS:');
  logger.log('=================================');
  logger.log('✅ READ: User2 can view notifications in "Shared Read Only"');
  logger.log(
    '✅ READ/WRITE: User2 can view/create notifications in "Shared ReadWrite"',
  );
  logger.log(
    '✅ READ/WRITE/DELETE: User2 can view/create/delete notifications in "Shared ReadWriteDelete"',
  );
  logger.log(
    '✅ ADMIN: User2 can do everything + manage permissions in "Shared Admin"',
  );
  logger.log(
    '✅ PERMISSIONS VIEWING: Both User1 and User2 should see sharing details for all shared buckets',
  );

  logger.log('\n🚀 AUTOMATIC ACTIONS TESTING SCENARIOS:');
  logger.log('========================================');
  logger.log('✅ Admin Notifications:');
  logger.log(
    '   • Full Set (EN): Mark as Read + Delete + Open + Snooze [15,30,60]',
  );
  logger.log(
    '   • Full Set (IT): Segna come Letta + Elimina + Apri + Posticipa [15,30,60]',
  );
  logger.log('   • Mark as Read + Open Only: Mark as Read + Open actions');
  logger.log('   • Snooze Demo: Mark as Read + Snooze [5,15,30,60,120]');
  logger.log('   • Delete Demo: Delete + Open actions');

  logger.log('\n✅ User1 Notifications:');
  logger.log('   • Personal Reminder: Mark as Read + Snooze [30,60]');
  logger.log('   • Important Alert: Delete + Open actions');
  logger.log('   • Work Project: Mark as Read + Open + Snooze [15,60]');

  logger.log('\n✅ User2 Notifications:');
  logger.log('   • Team Standup: Mark as Read + Open + Snooze [15,30]');
  logger.log('   • Code Review: Delete + Open + Snooze [60,120]');
  logger.log(
    '   • Collaborative: Mark as Read + Delete + Open + Snooze [30,60,120]',
  );

  logger.log('\n✅ Database initialization completed successfully!');
  logger.log('🧪 Ready for permission testing scenarios!');
  logger.log('🚀 Ready for automatic actions testing!');
}
