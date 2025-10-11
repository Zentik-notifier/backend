import { Test, TestingModule } from '@nestjs/testing';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { NotificationsService } from './notifications.service';
import { PushNotificationOrchestratorService } from './push-orchestrator.service';
import { UsersService } from '../users/users.service';
import { EventsService } from '../events/events.service';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { NotificationsResolver } from './notifications.resolver';
import { EventType } from '../entities/event.entity';

describe('NotificationsResolver', () => {
  let resolver: NotificationsResolver;
  let notificationsService: NotificationsService;

  const mockNotificationsService = {
    findByUserDeviceToken: jest.fn(),
    findOne: jest.fn(),
    markAsRead: jest.fn(),
    markAsUnread: jest.fn(),
    markAllAsRead: jest.fn(),
    remove: jest.fn(),
    getNotificationServices: jest.fn(),
    countRelatedUnreadNotifications: jest.fn(),
  };

  const mockUsersService = {
    findDeviceById: jest.fn(),
  };

  const mockSubscriptionService = {
    publishNotificationUpdated: jest.fn(),
    publishNotificationDeleted: jest.fn(),
  };

  const mockPushOrchestrator = {
    sendPushNotification: jest.fn(),
  };

  const mockEventsService = {
    createEvent: jest.fn(),
    getUserEvents: jest.fn(),
    findByUserId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsResolver,
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: GraphQLSubscriptionService,
          useValue: mockSubscriptionService,
        },
        {
          provide: PushNotificationOrchestratorService,
          useValue: mockPushOrchestrator,
        },
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<NotificationsResolver>(NotificationsResolver);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('notificationServices', () => {
    it('should return notification services for all platforms', async () => {
      const mockResponse = [
        {
          devicePlatform: 'IOS',
          service: 'PUSH',
        },
        {
          devicePlatform: 'ANDROID',
          service: 'LOCAL',
        },
      ];

      mockNotificationsService.getNotificationServices.mockResolvedValue(
        mockResponse,
      );

      const result = await resolver.notificationServices();

      expect(result).toEqual(mockResponse);
      expect(notificationsService.getNotificationServices).toHaveBeenCalled();
    });
  });

  describe('userNotificationStats', () => {
    it('should return notification stats for a user', async () => {
      const userId = 'test-user-id';

      // Mock events with different types
      const mockEvents = [
        {
          id: '1',
          type: EventType.NOTIFICATION,
          userId,
          createdAt: new Date(),
        },
        {
          id: '2',
          type: EventType.NOTIFICATION,
          userId,
          createdAt: new Date(),
        },
        {
          id: '3',
          type: EventType.MESSAGE, // Different type, should be filtered out
          userId,
          createdAt: new Date(),
        },
      ];

      mockEventsService.findByUserId.mockResolvedValue(mockEvents);

      const result = await resolver.userNotificationStats(userId);

      // Verify that the method returns the expected structure
      expect(result).toHaveProperty('today');
      expect(result).toHaveProperty('thisWeek');
      expect(result).toHaveProperty('last7Days');
      expect(result).toHaveProperty('thisMonth');
      expect(result).toHaveProperty('last30Days');
      expect(result).toHaveProperty('total');

      // Verify that only NOTIFICATION type events are counted in total
      expect(result.total).toBe(2);

      // Verify that the service was called correctly
      expect(mockEventsService.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return zero stats when no notification events exist', async () => {
      const userId = 'test-user-id';

      mockEventsService.findByUserId.mockResolvedValue([]);

      const result = await resolver.userNotificationStats(userId);

      expect(result).toEqual({
        today: 0,
        thisWeek: 0,
        last7Days: 0,
        thisMonth: 0,
        last30Days: 0,
        total: 0,
      });
      expect(mockEventsService.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should use current user id when no userId provided', async () => {
      const currentUserId = 'current-user-id';

      mockEventsService.findByUserId.mockResolvedValue([]);

      const result = await resolver.userNotificationStats(currentUserId);

      expect(result).toEqual({
        today: 0,
        thisWeek: 0,
        last7Days: 0,
        thisMonth: 0,
        last30Days: 0,
        total: 0,
      });
      expect(mockEventsService.findByUserId).toHaveBeenCalledWith(
        currentUserId,
      );
    });
  });

  describe('massMarkNotificationsAsRead', () => {
    it('should mark multiple notifications as read and count related notifications', async () => {
      const notificationIds = ['notification-1', 'notification-2'];
      const userId = 'user-1';

      const mockNotification1 = {
        id: 'notification-1',
        message: { id: 'message-1' },
        readAt: new Date(),
      };

      const mockNotification2 = {
        id: 'notification-2',
        message: { id: 'message-2' },
        readAt: new Date(),
      };

      mockNotificationsService.markAsRead
        .mockResolvedValueOnce(mockNotification1)
        .mockResolvedValueOnce(mockNotification2);

      mockNotificationsService.countRelatedUnreadNotifications
        .mockResolvedValueOnce(2) // 2 related notifications for message-1
        .mockResolvedValueOnce(1); // 1 related notification for message-2

      const result = await resolver.massMarkNotificationsAsRead(
        notificationIds,
        userId,
      );

      expect(result).toEqual({
        updatedCount: 5, // 2 main notifications + 2 related + 1 related
        success: true,
      });

      expect(mockNotificationsService.markAsRead).toHaveBeenCalledTimes(2);
      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(
        'notification-1',
        userId,
      );
      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(
        'notification-2',
        userId,
      );

      expect(
        mockNotificationsService.countRelatedUnreadNotifications,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockNotificationsService.countRelatedUnreadNotifications,
      ).toHaveBeenCalledWith('message-1', userId);
      expect(
        mockNotificationsService.countRelatedUnreadNotifications,
      ).toHaveBeenCalledWith('message-2', userId);

      expect(
        mockSubscriptionService.publishNotificationUpdated,
      ).toHaveBeenCalledTimes(2);
    });

    it('should handle notifications from the same message without double counting', async () => {
      const notificationIds = ['notification-1', 'notification-2'];
      const userId = 'user-1';

      const mockNotification1 = {
        id: 'notification-1',
        message: { id: 'message-1' },
        readAt: new Date(),
      };

      const mockNotification2 = {
        id: 'notification-2',
        message: { id: 'message-1' }, // Same message
        readAt: new Date(),
      };

      mockNotificationsService.markAsRead
        .mockResolvedValueOnce(mockNotification1)
        .mockResolvedValueOnce(mockNotification2);

      mockNotificationsService.countRelatedUnreadNotifications.mockResolvedValueOnce(
        1,
      ); // Only called once for message-1

      const result = await resolver.massMarkNotificationsAsRead(
        notificationIds,
        userId,
      );

      expect(result).toEqual({
        updatedCount: 3, // 2 main notifications + 1 related (not double counted)
        success: true,
      });

      expect(
        mockNotificationsService.countRelatedUnreadNotifications,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockNotificationsService.countRelatedUnreadNotifications,
      ).toHaveBeenCalledWith('message-1', userId);
    });

    it('should handle errors gracefully and continue processing', async () => {
      const notificationIds = ['notification-1', 'notification-2'];
      const userId = 'user-1';

      const mockNotification2 = {
        id: 'notification-2',
        message: { id: 'message-2' },
        readAt: new Date(),
      };

      mockNotificationsService.markAsRead
        .mockRejectedValueOnce(new Error('Failed to mark as read'))
        .mockResolvedValueOnce(mockNotification2);

      mockNotificationsService.countRelatedUnreadNotifications.mockResolvedValueOnce(
        1,
      );

      const result = await resolver.massMarkNotificationsAsRead(
        notificationIds,
        userId,
      );

      expect(result).toEqual({
        updatedCount: 2, // Only the successful notification + 1 related
        success: true,
      });

      expect(mockNotificationsService.markAsRead).toHaveBeenCalledTimes(2);
      expect(
        mockNotificationsService.countRelatedUnreadNotifications,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
