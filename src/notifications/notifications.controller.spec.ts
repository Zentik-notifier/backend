import { Test, TestingModule } from '@nestjs/testing';
import { AccessTokenService } from '../auth/access-token.service';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { SystemAccessTokenService } from '../system-access-token/system-access-token.service';
import { UsersService } from '../users/users.service';
import { IOSPushService } from './ios-push.service';
import { FirebasePushService } from './firebase-push.service';
import { WebPushService } from './web-push.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushNotificationOrchestratorService } from './push-orchestrator.service';
import { EventTrackingService } from '../events/event-tracking.service';
import { NotificationPostponeService } from './notification-postpone.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: NotificationsService;
  let usersService: UsersService;

  const mockNotificationsService = {
    findByUser: jest.fn(),
    markAsRead: jest.fn(),
    markAsUnread: jest.fn(),
    markAsReceivedByDeviceToken: jest.fn(),
    remove: jest.fn(),
    getNotificationServices: jest.fn(),
  };

  const mockSubscriptionService = {
    publishNotificationUpdated: jest.fn(),
    publishNotificationDeleted: jest.fn(),
  };

  const mockPushOrchestrator = {
    sendPushNotification: jest.fn(),
    create: jest.fn(),
  };

  const mockSystemAccessTokenService = {
    validateToken: jest.fn(),
  };

  const mockIOSPushService = {
    testConfiguration: jest.fn(),
    send: jest.fn(),
  };

  const mockFirebasePushService = {
    testConfiguration: jest.fn(),
    send: jest.fn(),
  };

  const mockWebPushService = {
    testConfiguration: jest.fn(),
    send: jest.fn(),
  };

  const mockAccessTokenService = {
    validateAccessToken: jest.fn(),
  };

  const mockEventTrackingService = {
    trackPushPassthrough: jest.fn(),
  };

  const mockPostponeService = {
    postponeNotification: jest.fn(),
    cancelPostpone: jest.fn(),
    getPostponedNotifications: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
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
          provide: SystemAccessTokenService,
          useValue: mockSystemAccessTokenService,
        },
        {
          provide: IOSPushService,
          useValue: mockIOSPushService,
        },
        {
          provide: FirebasePushService,
          useValue: mockFirebasePushService,
        },
        {
          provide: WebPushService,
          useValue: mockWebPushService,
        },
        {
          provide: AccessTokenService,
          useValue: mockAccessTokenService,
        },
        {
          provide: UsersService,
          useValue: { findDeviceByUserToken: jest.fn() },
        },
        {
          provide: EventTrackingService,
          useValue: mockEventTrackingService,
        },
        {
          provide: NotificationPostponeService,
          useValue: mockPostponeService,
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = { id: '1', readAt: new Date() };
      mockNotificationsService.markAsRead.mockResolvedValue(mockNotification);

      const result = await controller.markAsRead('1', 'user-1');

      expect(result).toEqual(mockNotification);
      expect(notificationsService.markAsRead).toHaveBeenCalledWith(
        '1',
        'user-1',
      );
    });
  });

  describe('getNotificationServices', () => {
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

      const result = await controller.getNotificationServices();

      expect(result).toEqual(mockResponse);
      expect(notificationsService.getNotificationServices).toHaveBeenCalled();
    });
  });
});
