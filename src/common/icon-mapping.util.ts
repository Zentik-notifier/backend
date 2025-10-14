import { DevicePlatform } from '../users/dto';

/**
 * Zentik Icon Names - Platform-agnostic icon identifiers
 * Used across all platforms with automatic platform-specific rendering
 */
export enum ZentikIcon {
  // Communication & Alerts
  BELL = 'bell',
  ENVELOPE = 'envelope',
  MESSAGE = 'message',
  PHONE = 'phone',

  // Status & Actions
  CHECKMARK = 'checkmark',
  XMARK = 'xmark',
  EXCLAMATION = 'exclamation',
  INFO = 'info',
  QUESTION = 'question',

  // Time & Calendar
  CLOCK = 'clock',
  CALENDAR = 'calendar',
  TIMER = 'timer',
  ALARM = 'alarm',
  HOURGLASS = 'hourglass',

  // Navigation & Interaction
  ARROW_RIGHT = 'arrow_right',
  ARROW_LEFT = 'arrow_left',
  ARROW_UP = 'arrow_up',
  ARROW_DOWN = 'arrow_down',
  CHEVRON_RIGHT = 'chevron_right',
  CHEVRON_LEFT = 'chevron_left',
  HOME = 'home',
  LOCATION = 'location',
  MAP = 'map',

  // Media & Files
  PHOTO = 'photo',
  VIDEO = 'video',
  MUSIC = 'music',
  HEADPHONES = 'headphones',
  MIC = 'mic',
  SPEAKER = 'speaker',
  DOCUMENT = 'document',
  FOLDER = 'folder',
  PAPERCLIP = 'paperclip',

  // Social & People
  PERSON = 'person',
  PEOPLE = 'people',
  HEART = 'heart',
  STAR = 'star',
  FLAME = 'flame',

  // Technology & Devices
  PHONE_MOBILE = 'phone_mobile',
  COMPUTER = 'computer',
  LAPTOP = 'laptop',
  WIFI = 'wifi',
  BATTERY = 'battery',
  BOLT = 'bolt',
  GEAR = 'gear',

  // Weather & Nature
  SUN = 'sun',
  MOON = 'moon',
  CLOUD = 'cloud',
  RAIN = 'rain',
  SNOW = 'snow',

  // Business & Finance
  DOLLAR = 'dollar',
  CREDIT_CARD = 'credit_card',
  CART = 'cart',
  BAG = 'bag',

  // Health & Fitness
  HEART_PULSE = 'heart_pulse',
  WALK = 'walk',
  BICYCLE = 'bicycle',
  SPORT = 'sport',

  // Transportation
  CAR = 'car',
  AIRPLANE = 'airplane',
  TRAIN = 'train',
  BUS = 'bus',

  // Food & Drink
  COFFEE = 'coffee',
  FOOD = 'food',

  // Miscellaneous
  LOCK = 'lock',
  KEY = 'key',
  TAG = 'tag',
  GIFT = 'gift',
  FLAG = 'flag',
  TRASH = 'trash',
}

/**
 * Platform-specific icon configuration
 */
export interface IconPlatformMapping {
  ios: string; // SF Symbol name
  web: string; // Emoji (same as Android)
  android: string; // Emoji
}

/**
 * Cross-platform icon mappings for all Zentik icons
 * Maps each ZentikIcon to platform-specific representations
 */
export const ZENTIK_ICON_MAPPINGS: Record<ZentikIcon, IconPlatformMapping> = {
  // Communication & Alerts
  [ZentikIcon.BELL]: {
    ios: 'bell.fill',
    web: '🔔',
    android: '🔔',
  },
  [ZentikIcon.ENVELOPE]: {
    ios: 'envelope.fill',
    web: '✉️',
    android: '✉️',
  },
  [ZentikIcon.MESSAGE]: {
    ios: 'message.fill',
    web: '💬',
    android: '💬',
  },
  [ZentikIcon.PHONE]: {
    ios: 'phone.fill',
    web: '📞',
    android: '📞',
  },

  // Status & Actions
  [ZentikIcon.CHECKMARK]: {
    ios: 'checkmark.circle.fill',
    web: '✅',
    android: '✅',
  },
  [ZentikIcon.XMARK]: {
    ios: 'xmark.circle.fill',
    web: '❌',
    android: '❌',
  },
  [ZentikIcon.EXCLAMATION]: {
    ios: 'exclamationmark.triangle.fill',
    web: '⚠️',
    android: '⚠️',
  },
  [ZentikIcon.INFO]: {
    ios: 'info.circle.fill',
    web: 'ℹ️',
    android: 'ℹ️',
  },
  [ZentikIcon.QUESTION]: {
    ios: 'questionmark.circle.fill',
    web: '❓',
    android: '❓',
  },

  // Time & Calendar
  [ZentikIcon.CLOCK]: {
    ios: 'clock.fill',
    web: '⏰',
    android: '⏰',
  },
  [ZentikIcon.CALENDAR]: {
    ios: 'calendar',
    web: '📅',
    android: '📅',
  },
  [ZentikIcon.TIMER]: {
    ios: 'timer',
    web: '⏱️',
    android: '⏱️',
  },
  [ZentikIcon.ALARM]: {
    ios: 'alarm.fill',
    web: '⏰',
    android: '⏰',
  },
  [ZentikIcon.HOURGLASS]: {
    ios: 'hourglass',
    web: '⏳',
    android: '⏳',
  },

  // Navigation & Interaction
  [ZentikIcon.ARROW_RIGHT]: {
    ios: 'arrow.right',
    web: '➡️',
    android: '➡️',
  },
  [ZentikIcon.ARROW_LEFT]: {
    ios: 'arrow.left',
    web: '⬅️',
    android: '⬅️',
  },
  [ZentikIcon.ARROW_UP]: {
    ios: 'arrow.up',
    web: '⬆️',
    android: '⬆️',
  },
  [ZentikIcon.ARROW_DOWN]: {
    ios: 'arrow.down',
    web: '⬇️',
    android: '⬇️',
  },
  [ZentikIcon.CHEVRON_RIGHT]: {
    ios: 'chevron.right',
    web: '▶️',
    android: '▶️',
  },
  [ZentikIcon.CHEVRON_LEFT]: {
    ios: 'chevron.left',
    web: '◀️',
    android: '◀️',
  },
  [ZentikIcon.HOME]: {
    ios: 'house.fill',
    web: '🏠',
    android: '🏠',
  },
  [ZentikIcon.LOCATION]: {
    ios: 'location.fill',
    web: '📍',
    android: '📍',
  },
  [ZentikIcon.MAP]: {
    ios: 'map.fill',
    web: '🗺️',
    android: '🗺️',
  },

  // Media & Files
  [ZentikIcon.PHOTO]: {
    ios: 'photo.fill',
    web: '🖼️',
    android: '🖼️',
  },
  [ZentikIcon.VIDEO]: {
    ios: 'video.fill',
    web: '🎥',
    android: '🎥',
  },
  [ZentikIcon.MUSIC]: {
    ios: 'music.note',
    web: '🎵',
    android: '🎵',
  },
  [ZentikIcon.HEADPHONES]: {
    ios: 'headphones',
    web: '🎧',
    android: '🎧',
  },
  [ZentikIcon.MIC]: {
    ios: 'mic.fill',
    web: '🎤',
    android: '🎤',
  },
  [ZentikIcon.SPEAKER]: {
    ios: 'speaker.wave.2.fill',
    web: '🔊',
    android: '🔊',
  },
  [ZentikIcon.DOCUMENT]: {
    ios: 'doc.fill',
    web: '📄',
    android: '📄',
  },
  [ZentikIcon.FOLDER]: {
    ios: 'folder.fill',
    web: '📁',
    android: '📁',
  },
  [ZentikIcon.PAPERCLIP]: {
    ios: 'paperclip',
    web: '📎',
    android: '📎',
  },

  // Social & People
  [ZentikIcon.PERSON]: {
    ios: 'person.fill',
    web: '👤',
    android: '👤',
  },
  [ZentikIcon.PEOPLE]: {
    ios: 'person.2.fill',
    web: '👥',
    android: '👥',
  },
  [ZentikIcon.HEART]: {
    ios: 'heart.fill',
    web: '❤️',
    android: '❤️',
  },
  [ZentikIcon.STAR]: {
    ios: 'star.fill',
    web: '⭐',
    android: '⭐',
  },
  [ZentikIcon.FLAME]: {
    ios: 'flame.fill',
    web: '🔥',
    android: '🔥',
  },

  // Technology & Devices
  [ZentikIcon.PHONE_MOBILE]: {
    ios: 'iphone',
    web: '📱',
    android: '📱',
  },
  [ZentikIcon.COMPUTER]: {
    ios: 'desktopcomputer',
    web: '🖥️',
    android: '🖥️',
  },
  [ZentikIcon.LAPTOP]: {
    ios: 'laptopcomputer',
    web: '💻',
    android: '💻',
  },
  [ZentikIcon.WIFI]: {
    ios: 'wifi',
    web: '📶',
    android: '📶',
  },
  [ZentikIcon.BATTERY]: {
    ios: 'battery.100',
    web: '🔋',
    android: '🔋',
  },
  [ZentikIcon.BOLT]: {
    ios: 'bolt.fill',
    web: '⚡',
    android: '⚡',
  },
  [ZentikIcon.GEAR]: {
    ios: 'gear',
    web: '⚙️',
    android: '⚙️',
  },

  // Weather & Nature
  [ZentikIcon.SUN]: {
    ios: 'sun.max.fill',
    web: '☀️',
    android: '☀️',
  },
  [ZentikIcon.MOON]: {
    ios: 'moon.fill',
    web: '🌙',
    android: '🌙',
  },
  [ZentikIcon.CLOUD]: {
    ios: 'cloud.fill',
    web: '☁️',
    android: '☁️',
  },
  [ZentikIcon.RAIN]: {
    ios: 'cloud.rain.fill',
    web: '🌧️',
    android: '🌧️',
  },
  [ZentikIcon.SNOW]: {
    ios: 'snowflake',
    web: '❄️',
    android: '❄️',
  },

  // Business & Finance
  [ZentikIcon.DOLLAR]: {
    ios: 'dollarsign.circle.fill',
    web: '💵',
    android: '💵',
  },
  [ZentikIcon.CREDIT_CARD]: {
    ios: 'creditcard.fill',
    web: '💳',
    android: '💳',
  },
  [ZentikIcon.CART]: {
    ios: 'cart.fill',
    web: '🛒',
    android: '🛒',
  },
  [ZentikIcon.BAG]: {
    ios: 'bag.fill',
    web: '🛍️',
    android: '🛍️',
  },

  // Health & Fitness
  [ZentikIcon.HEART_PULSE]: {
    ios: 'heart.text.square.fill',
    web: '💓',
    android: '💓',
  },
  [ZentikIcon.WALK]: {
    ios: 'figure.walk',
    web: '🚶',
    android: '🚶',
  },
  [ZentikIcon.BICYCLE]: {
    ios: 'bicycle',
    web: '🚴',
    android: '🚴',
  },
  [ZentikIcon.SPORT]: {
    ios: 'sportscourt.fill',
    web: '⚽',
    android: '⚽',
  },

  // Transportation
  [ZentikIcon.CAR]: {
    ios: 'car.fill',
    web: '🚗',
    android: '🚗',
  },
  [ZentikIcon.AIRPLANE]: {
    ios: 'airplane',
    web: '✈️',
    android: '✈️',
  },
  [ZentikIcon.TRAIN]: {
    ios: 'train.side.front.car',
    web: '🚆',
    android: '🚆',
  },
  [ZentikIcon.BUS]: {
    ios: 'bus.fill',
    web: '🚌',
    android: '🚌',
  },

  // Food & Drink
  [ZentikIcon.COFFEE]: {
    ios: 'cup.and.saucer.fill',
    web: '☕',
    android: '☕',
  },
  [ZentikIcon.FOOD]: {
    ios: 'fork.knife',
    web: '🍴',
    android: '🍴',
  },

  // Miscellaneous
  [ZentikIcon.LOCK]: {
    ios: 'lock.fill',
    web: '🔒',
    android: '🔒',
  },
  [ZentikIcon.KEY]: {
    ios: 'key.fill',
    web: '🔑',
    android: '🔑',
  },
  [ZentikIcon.TAG]: {
    ios: 'tag.fill',
    web: '🏷️',
    android: '🏷️',
  },
  [ZentikIcon.GIFT]: {
    ios: 'gift.fill',
    web: '🎁',
    android: '🎁',
  },
  [ZentikIcon.FLAG]: {
    ios: 'flag.fill',
    web: '🏁',
    android: '🏁',
  },
  [ZentikIcon.TRASH]: {
    ios: 'trash.fill',
    web: '🗑️',
    android: '🗑️',
  },
};

/**
 * Gets the icon name for a specific platform
 * @param zentikIcon - Zentik icon identifier
 * @param platform - Target platform (IOS, ANDROID, WEB)
 * @returns Platform-specific icon name
 */
export function getIconForPlatform(
  zentikIcon: ZentikIcon,
  platform: DevicePlatform,
): string {
  const mapping = ZENTIK_ICON_MAPPINGS[zentikIcon];
  if (!mapping) return zentikIcon;
  
  // Map DevicePlatform enum (IOS, ANDROID, WEB) to IconPlatformMapping keys (ios, android, web)
  const platformKey = platform.toLowerCase() as keyof IconPlatformMapping;
  return mapping[platformKey] || zentikIcon;
}

/**
 * Gets all platform-specific icons for a Zentik icon
 * @param zentikIcon - Zentik icon identifier
 * @returns Object with ios, web, and android icon names
 */
export function getAllPlatformIcons(
  zentikIcon: ZentikIcon,
): IconPlatformMapping | null {
  return ZENTIK_ICON_MAPPINGS[zentikIcon] || null;
}

/**
 * Gets all available Zentik icon mappings
 * @returns Complete icon mapping configuration
 */
export function getAllIconMappings(): Record<ZentikIcon, IconPlatformMapping> {
  return ZENTIK_ICON_MAPPINGS;
}

/**
 * Checks if a Zentik icon exists in the mapping
 * @param zentikIcon - Zentik icon identifier to check
 * @returns true if icon exists, false otherwise
 */
export function hasIconMapping(zentikIcon: ZentikIcon): boolean {
  return zentikIcon in ZENTIK_ICON_MAPPINGS;
}

/**
 * Lists all available Zentik icon names
 * @returns Array of all Zentik icon identifiers
 */
export function listAllIcons(): ZentikIcon[] {
  return Object.values(ZentikIcon);
}
