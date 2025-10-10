import { LocaleService } from '../common/services/locale.service';
import { Locale } from '../common/types/i18n';
import { NotificationAction } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { DevicePlatform } from '../users/dto';
import { NotificationActionType } from './notifications.types';

export function generateAutomaticActions(
  notification: Notification,
  platform: DevicePlatform,
  localeService: LocaleService,
): NotificationAction[] {
  const message = notification.message;
  const actions: NotificationAction[] = [];
  const locale = (message.locale || 'en-EN') as Locale;

  const deleteAction = localeService.getTranslatedText(
    locale,
    'notifications.actions.delete',
  );
  const markAsRead = localeService.getTranslatedText(
    locale,
    'notifications.actions.markAsRead',
  );
  const open = localeService.getTranslatedText(
    locale,
    'notifications.actions.open',
  );

  const icons = {
    [DevicePlatform.IOS]: {
      delete: 'trash',
      markAsRead: 'checkmark.circle',
      open: 'arrow.up.circle',
      snooze: 'clock',
    },
    [DevicePlatform.ANDROID]: {
      delete: 'ic_delete',
      markAsRead: 'ic_check_circle',
      open: 'ic_open_in_new',
      snooze: 'ic_access_time',
    },
    [DevicePlatform.WEB]: {
      delete: '🗑️',
      markAsRead: '✅',
      open: '🔗',
      snooze: '⏰',
    },
  } as const;

  const platformIcons = icons[platform] ?? icons[DevicePlatform.WEB];

  // Default behavior: add action if flag is undefined or true
  // Only skip if explicitly set to false
  if (message.addDeleteAction !== false) {
    actions.push({
      type: NotificationActionType.DELETE,
      value: 'delete_notification',
      destructive: true,
      icon: platformIcons.delete,
      title: deleteAction,
    });
  }

  if (message.addMarkAsReadAction !== false) {
    actions.push({
      type: NotificationActionType.MARK_AS_READ,
      value: 'mark_as_read_notification',
      destructive: false,
      icon: platformIcons.markAsRead,
      title: markAsRead,
    });
  }

  if (message.addOpenNotificationAction) {
    actions.push({
      type: NotificationActionType.OPEN_NOTIFICATION,
      value: notification.id, // Use notification ID instead of fixed string
      destructive: false,
      icon: platformIcons.open,
      title: open,
    });
  }

  if (message.snoozes && message.snoozes.length > 0) {
    message.snoozes.forEach((snoozeMinutes) => {
      const snooze = localeService.getTranslatedText(
        locale,
        'notifications.actions.snooze',
        { minutes: String(snoozeMinutes) },
      );

      actions.push({
        type: NotificationActionType.SNOOZE,
        value: snoozeMinutes.toString(),
        destructive: false,
        icon: platformIcons.snooze,
        title: snooze,
      });
    });
  }

  return actions;
}
