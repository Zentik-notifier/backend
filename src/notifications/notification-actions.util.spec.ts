import { LocaleService } from '../common/services/locale.service';
import { Notification } from '../entities/notification.entity';
import { DevicePlatform } from '../users/dto';
import { AutoActionSettings, generateAutomaticActions } from './notification-actions.util';
import { NotificationActionType } from './notifications.types';

describe('notification-actions.util', () => {
  let mockLocaleService: LocaleService;

  beforeEach(() => {
    mockLocaleService = {
      getTranslatedText: jest.fn((locale: string, key: string, params?: any) => {
        const translations: Record<string, string> = {
          'notifications.actions.delete': 'Delete',
          'notifications.actions.markAsRead': 'Mark as Read',
          'notifications.actions.open': 'Open',
          'notifications.actions.snooze': params ? `Snooze ${params.minutes}m` : 'Snooze',
        };
        return translations[key] || key;
      }),
    } as any;
  });

  describe('generateAutomaticActions', () => {
    const mockNotification: Partial<Notification> = {
      id: 'notif-1',
      userId: 'user-1',
      message: {
        id: 'message-1',
        title: 'Test',
        locale: 'en-EN',
      } as any,
    };

    describe('Default behavior (no user settings, no payload flags)', () => {
      it('should not add actions by default for iOS', () => {
        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
        );

        expect(actions).toHaveLength(0);
      });

      it('should not add actions by default for Android', () => {
        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.ANDROID,
          mockLocaleService,
        );

        expect(actions).toHaveLength(0);
      });

      it('should not add actions by default for Web', () => {
        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.WEB,
          mockLocaleService,
        );

        expect(actions).toHaveLength(0);
      });
    });

    describe('User settings override defaults', () => {
      it('should respect user settings when payload flags are undefined', () => {
        const userSettings: AutoActionSettings = {
          autoAddDeleteAction: false,
          autoAddMarkAsReadAction: false,
          autoAddOpenNotificationAction: false,
        };

        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          userSettings,
        );

        expect(actions).toHaveLength(0);
      });

      it('should only add actions enabled in user settings', () => {
        const userSettings: AutoActionSettings = {
          autoAddDeleteAction: true,
          autoAddMarkAsReadAction: false,
          autoAddOpenNotificationAction: true,
        };

        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          userSettings,
        );

        expect(actions).toHaveLength(2);
        expect(actions.find(a => a.type === NotificationActionType.DELETE)).toBeDefined();
        expect(actions.find(a => a.type === NotificationActionType.MARK_AS_READ)).toBeUndefined();
        expect(actions.find(a => a.type === NotificationActionType.OPEN_NOTIFICATION)).toBeDefined();
      });
    });

    describe('Payload flags override user settings', () => {
      it('should use payload flag when explicitly set to false, ignoring user settings', () => {
        const userSettings: AutoActionSettings = {
          autoAddDeleteAction: true,
          autoAddMarkAsReadAction: true,
          autoAddOpenNotificationAction: true,
        };

        const notificationWithFlags: Partial<Notification> = {
          ...mockNotification,
          message: {
            ...mockNotification.message,
            addDeleteAction: false,
            addMarkAsReadAction: false,
            addOpenNotificationAction: false,
          } as any,
        };

        const actions = generateAutomaticActions(
          notificationWithFlags as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          userSettings,
        );

        expect(actions).toHaveLength(0);
      });

      it('should use payload flag when explicitly set to true, ignoring user settings', () => {
        const userSettings: AutoActionSettings = {
          autoAddDeleteAction: false,
          autoAddMarkAsReadAction: false,
          autoAddOpenNotificationAction: false,
        };

        const notificationWithFlags: Partial<Notification> = {
          ...mockNotification,
          message: {
            ...mockNotification.message,
            addDeleteAction: true,
            addMarkAsReadAction: true,
            addOpenNotificationAction: true,
          } as any,
        };

        const actions = generateAutomaticActions(
          notificationWithFlags as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          userSettings,
        );

        expect(actions).toHaveLength(3);
        expect(actions.find(a => a.type === NotificationActionType.DELETE)).toBeDefined();
        expect(actions.find(a => a.type === NotificationActionType.MARK_AS_READ)).toBeDefined();
        expect(actions.find(a => a.type === NotificationActionType.OPEN_NOTIFICATION)).toBeDefined();
      });

      it('should mix payload flags and user settings correctly', () => {
        const userSettings: AutoActionSettings = {
          autoAddDeleteAction: false,
          autoAddMarkAsReadAction: true,
          autoAddOpenNotificationAction: false,
        };

        const notificationWithFlags: Partial<Notification> = {
          ...mockNotification,
          message: {
            ...mockNotification.message,
            addDeleteAction: true, // Override user setting
            // addMarkAsReadAction: undefined, // Use user setting (true)
            addOpenNotificationAction: true, // Override user setting
          } as any,
        };

        const actions = generateAutomaticActions(
          notificationWithFlags as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          userSettings,
        );

        expect(actions).toHaveLength(3);
        expect(actions.find(a => a.type === NotificationActionType.DELETE)).toBeDefined();
        expect(actions.find(a => a.type === NotificationActionType.MARK_AS_READ)).toBeDefined();
        expect(actions.find(a => a.type === NotificationActionType.OPEN_NOTIFICATION)).toBeDefined();
      });
    });

    describe('Priority decision logic', () => {
      it('should follow priority: payload > user settings > default', () => {
        // Test 1: No payload, no user settings -> default (false)
        let actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
        );
        expect(actions).toHaveLength(0);

        // Test 2: No payload, user settings false -> user settings (false)
        actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          { autoAddDeleteAction: false, autoAddMarkAsReadAction: false, autoAddOpenNotificationAction: false },
        );
        expect(actions).toHaveLength(0);

        // Test 3: Payload true, user settings false -> payload (true)
        const notificationWithFlags: Partial<Notification> = {
          ...mockNotification,
          message: {
            ...mockNotification.message,
            addDeleteAction: true,
            addMarkAsReadAction: true,
            addOpenNotificationAction: true,
          } as any,
        };
        actions = generateAutomaticActions(
          notificationWithFlags as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          { autoAddDeleteAction: false, autoAddMarkAsReadAction: false, autoAddOpenNotificationAction: false },
        );
        expect(actions).toHaveLength(3);
      });
    });

    describe('Snooze actions', () => {
      it('should add snooze actions when provided in message', () => {
        const notificationWithSnooze: Partial<Notification> = {
          ...mockNotification,
          message: {
            ...mockNotification.message,
            snoozes: [5, 15, 30],
          } as any,
        };

        const actions = generateAutomaticActions(
          notificationWithSnooze as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
        );

        expect(actions).toHaveLength(3); // 0 automatic + 3 snoozes (default is false)
        const snoozeActions = actions.filter(a => a.type === NotificationActionType.SNOOZE);
        expect(snoozeActions).toHaveLength(3);
        expect(snoozeActions[0].value).toBe('5');
        expect(snoozeActions[1].value).toBe('15');
        expect(snoozeActions[2].value).toBe('30');
      });

      it('should not add snooze actions when snoozes array is empty', () => {
        const notificationWithSnooze: Partial<Notification> = {
          ...mockNotification,
          message: {
            ...mockNotification.message,
            snoozes: [],
          } as any,
        };

        const actions = generateAutomaticActions(
          notificationWithSnooze as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
        );

        expect(actions).toHaveLength(0); // No automatic actions (default is false), no snoozes
      });
    });

    describe('Platform-specific icons', () => {
      it('should use iOS-specific icons (SF Symbols)', () => {
        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          { autoAddDeleteAction: true, autoAddMarkAsReadAction: true, autoAddOpenNotificationAction: true },
        );

        const deleteAction = actions.find(a => a.type === NotificationActionType.DELETE);
        const markAsReadAction = actions.find(a => a.type === NotificationActionType.MARK_AS_READ);
        const openAction = actions.find(a => a.type === NotificationActionType.OPEN_NOTIFICATION);

        // iOS uses SF Symbols
        expect(deleteAction?.icon).toBe('trash.fill');
        expect(markAsReadAction?.icon).toBe('checkmark.circle.fill');
        expect(openAction?.icon).toBe('arrow.up');
      });

      it('should use Android-specific icons (Emoji)', () => {
        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.ANDROID,
          mockLocaleService,
          { autoAddDeleteAction: true, autoAddMarkAsReadAction: true, autoAddOpenNotificationAction: true },
        );

        const deleteAction = actions.find(a => a.type === NotificationActionType.DELETE);
        const markAsReadAction = actions.find(a => a.type === NotificationActionType.MARK_AS_READ);
        const openAction = actions.find(a => a.type === NotificationActionType.OPEN_NOTIFICATION);

        // Android uses Emoji
        expect(deleteAction?.icon).toBe('🗑️');
        expect(markAsReadAction?.icon).toBe('✅');
        expect(openAction?.icon).toBe('⬆️');
      });

      it('should use Web-specific icons (Material Design)', () => {
        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.WEB,
          mockLocaleService,
          { autoAddDeleteAction: true, autoAddMarkAsReadAction: true, autoAddOpenNotificationAction: true },
        );

        const deleteAction = actions.find(a => a.type === NotificationActionType.DELETE);
        const markAsReadAction = actions.find(a => a.type === NotificationActionType.MARK_AS_READ);
        const openAction = actions.find(a => a.type === NotificationActionType.OPEN_NOTIFICATION);

        // Web uses Material Design Icons
        expect(deleteAction?.icon).toBe('delete');
        expect(markAsReadAction?.icon).toBe('check_circle');
        expect(openAction?.icon).toBe('arrow_upward');
      });

      it('should use correct snooze icons for each platform', () => {
        const notificationWithSnooze: Partial<Notification> = {
          ...mockNotification,
          message: {
            ...mockNotification.message,
            snoozes: [15],
          } as any,
        };

        // iOS
        let actions = generateAutomaticActions(
          notificationWithSnooze as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
        );
        let snoozeAction = actions.find(a => a.type === NotificationActionType.SNOOZE);
        expect(snoozeAction?.icon).toBe('clock.fill');

        // Android
        actions = generateAutomaticActions(
          notificationWithSnooze as Notification,
          DevicePlatform.ANDROID,
          mockLocaleService,
        );
        snoozeAction = actions.find(a => a.type === NotificationActionType.SNOOZE);
        expect(snoozeAction?.icon).toBe('⏰');

        // Web
        actions = generateAutomaticActions(
          notificationWithSnooze as Notification,
          DevicePlatform.WEB,
          mockLocaleService,
        );
        snoozeAction = actions.find(a => a.type === NotificationActionType.SNOOZE);
        expect(snoozeAction?.icon).toBe('schedule');
      });
    });

    describe('Action properties', () => {
      it('should set delete action as destructive', () => {
        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          { autoAddDeleteAction: true, autoAddMarkAsReadAction: true, autoAddOpenNotificationAction: true },
        );

        const deleteAction = actions.find(a => a.type === NotificationActionType.DELETE);
        expect(deleteAction?.destructive).toBe(true);
      });

      it('should set mark as read action as non-destructive', () => {
        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          { autoAddDeleteAction: true, autoAddMarkAsReadAction: true, autoAddOpenNotificationAction: true },
        );

        const markAsReadAction = actions.find(a => a.type === NotificationActionType.MARK_AS_READ);
        expect(markAsReadAction?.destructive).toBe(false);
      });

      it('should use notification ID for open action value', () => {
        const actions = generateAutomaticActions(
          mockNotification as Notification,
          DevicePlatform.IOS,
          mockLocaleService,
          { autoAddDeleteAction: true, autoAddMarkAsReadAction: true, autoAddOpenNotificationAction: true },
        );

        const openAction = actions.find(a => a.type === NotificationActionType.OPEN_NOTIFICATION);
        expect(openAction?.value).toBe('notif-1');
      });
    });
  });
});
