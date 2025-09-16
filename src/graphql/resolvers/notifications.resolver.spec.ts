import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtOrAccessTokenGuard } from '../../auth/guards/jwt-or-access-token.guard';
import { 
  NotificationsPerUserDailyView,
  NotificationsPerUserWeeklyView,
  NotificationsPerUserMonthlyView,
  NotificationsPerUserAllTimeView
} from '../../entities/views/notifications-analytics.views';
import { NotificationsService } from '../../notifications/notifications.service';
import { PushNotificationOrchestratorService } from '../../notifications/push-orchestrator.service';
import { UsersService } from '../../users/users.service';
import { GraphQLSubscriptionService } from '../services/graphql-subscription.service';
import { NotificationsResolver } from './notifications.resolver';

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

  const mockDailyViewRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockWeeklyViewRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockMonthlyViewRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockAllTimeViewRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
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
          provide: getRepositoryToken(NotificationsPerUserDailyView),
          useValue: mockDailyViewRepository,
        },
        {
          provide: getRepositoryToken(NotificationsPerUserWeeklyView),
          useValue: mockWeeklyViewRepository,
        },
        {
          provide: getRepositoryToken(NotificationsPerUserMonthlyView),
          useValue: mockMonthlyViewRepository,
        },
        {
          provide: getRepositoryToken(NotificationsPerUserAllTimeView),
          useValue: mockAllTimeViewRepository,
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

});
