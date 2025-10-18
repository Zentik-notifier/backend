import { LocaleService } from '../common/services/locale.service';
import { Locale } from '../common/types/i18n';
import { NotificationAction } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { DevicePlatform } from '../users/dto';
import { NotificationActionType } from './notifications.types';
import { ZentikIcon, getIconForPlatform } from '../common/icon-mapping.util';

export interface AutoActionSettings {
  autoAddDeleteAction?: boolean;
  autoAddMarkAsReadAction?: boolean;
  autoAddOpenNotificationAction?: boolean;
}

export function generateAutomaticActions(
  notification: Notification,
  platform: DevicePlatform,
  localeService: LocaleService,
  userSettings?: AutoActionSettings,
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

  // Get platform-specific icons using ZentikIcon mapping
  // getIconForPlatform now accepts DevicePlatform directly
  const platformIcons = {
    delete: getIconForPlatform(ZentikIcon.TRASH, platform),
    markAsRead: getIconForPlatform(ZentikIcon.CHECKMARK, platform),
    open: getIconForPlatform(ZentikIcon.ARROW_UP, platform),
    snooze: getIconForPlatform(ZentikIcon.CLOCK, platform),
    postpone: getIconForPlatform(ZentikIcon.HOURGLASS, platform),
  };

  // Determine whether to add each action based on:
  // 1. Explicit payload flag (if defined and not null, use it)
  // 2. User settings (if payload flag is null/undefined, use user settings)
  // 3. Default behavior (if both are null/undefined, use default)

  const shouldAddDeleteAction =
    message.addDeleteAction != null
      ? message.addDeleteAction
      : (userSettings?.autoAddDeleteAction ?? true);

  const shouldAddMarkAsReadAction =
    message.addMarkAsReadAction != null
      ? message.addMarkAsReadAction
      : (userSettings?.autoAddMarkAsReadAction ?? true);

  const shouldAddOpenNotificationAction =
    message.addOpenNotificationAction != null
      ? message.addOpenNotificationAction
      : (userSettings?.autoAddOpenNotificationAction ?? false);

  if (shouldAddDeleteAction) {
    actions.push({
      type: NotificationActionType.DELETE,
      value: 'delete_notification',
      destructive: true,
      icon: platformIcons.delete,
      title: deleteAction,
    });
  }

  if (shouldAddMarkAsReadAction) {
    actions.push({
      type: NotificationActionType.MARK_AS_READ,
      value: 'mark_as_read_notification',
      destructive: false,
      icon: platformIcons.markAsRead,
      title: markAsRead,
    });
  }

  if (shouldAddOpenNotificationAction) {
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

  if (message.postpones && message.postpones.length > 0) {
    message.postpones.forEach((postponeMinutes) => {
      const postpone = localeService.getTranslatedText(
        locale,
        'notifications.actions.postpone',
        { minutes: String(postponeMinutes) },
      );

      actions.push({
        type: NotificationActionType.POSTPONE,
        value: postponeMinutes.toString(),
        destructive: false,
        icon: platformIcons.postpone,
        title: postpone,
      });
    });
  }

  return actions;
}
