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
  web: string; // Material Design Icon name or emoji
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
    web: 'notifications',
    android: '🔔',
  },
  [ZentikIcon.ENVELOPE]: {
    ios: 'envelope.fill',
    web: 'mail',
    android: '✉️',
  },
  [ZentikIcon.MESSAGE]: {
    ios: 'message.fill',
    web: 'message',
    android: '�',
  },
  [ZentikIcon.PHONE]: {
    ios: 'phone.fill',
    web: 'phone',
    android: '📞',
  },

  // Status & Actions
  [ZentikIcon.CHECKMARK]: {
    ios: 'checkmark.circle.fill',
    web: 'check_circle',
    android: '✅',
  },
  [ZentikIcon.XMARK]: {
    ios: 'xmark.circle.fill',
    web: 'cancel',
    android: '❌',
  },
  [ZentikIcon.EXCLAMATION]: {
    ios: 'exclamationmark.triangle.fill',
    web: 'warning',
    android: '⚠️',
  },
  [ZentikIcon.INFO]: {
    ios: 'info.circle.fill',
    web: 'info',
    android: 'ℹ️',
  },
  [ZentikIcon.QUESTION]: {
    ios: 'questionmark.circle.fill',
    web: 'help',
    android: '❓',
  },

  // Time & Calendar
  [ZentikIcon.CLOCK]: {
    ios: 'clock.fill',
    web: 'schedule',
    android: '⏰',
  },
  [ZentikIcon.CALENDAR]: {
    ios: 'calendar',
    web: 'calendar_today',
    android: '📅',
  },
  [ZentikIcon.TIMER]: {
    ios: 'timer',
    web: 'timer',
    android: '⏱️',
  },
  [ZentikIcon.ALARM]: {
    ios: 'alarm.fill',
    web: 'alarm',
    android: '⏰',
  },
  [ZentikIcon.HOURGLASS]: {
    ios: 'hourglass',
    web: 'hourglass_empty',
    android: '⏳',
  },

  // Navigation & Interaction
  [ZentikIcon.ARROW_RIGHT]: {
    ios: 'arrow.right',
    web: 'arrow_forward',
    android: '➡️',
  },
  [ZentikIcon.ARROW_LEFT]: {
    ios: 'arrow.left',
    web: 'arrow_back',
    android: '⬅️',
  },
  [ZentikIcon.ARROW_UP]: {
    ios: 'arrow.up',
    web: 'arrow_upward',
    android: '⬆️',
  },
  [ZentikIcon.ARROW_DOWN]: {
    ios: 'arrow.down',
    web: 'arrow_downward',
    android: '⬇️',
  },
  [ZentikIcon.CHEVRON_RIGHT]: {
    ios: 'chevron.right',
    web: 'chevron_right',
    android: '▶️',
  },
  [ZentikIcon.CHEVRON_LEFT]: {
    ios: 'chevron.left',
    web: 'chevron_left',
    android: '◀️',
  },
  [ZentikIcon.HOME]: {
    ios: 'house.fill',
    web: 'home',
    android: '🏠',
  },
  [ZentikIcon.LOCATION]: {
    ios: 'location.fill',
    web: 'location_on',
    android: '�',
  },
  [ZentikIcon.MAP]: {
    ios: 'map.fill',
    web: 'map',
    android: '🗺️',
  },

  // Media & Files
  [ZentikIcon.PHOTO]: {
    ios: 'photo.fill',
    web: 'image',
    android: '🖼️',
  },
  [ZentikIcon.VIDEO]: {
    ios: 'video.fill',
    web: 'videocam',
    android: '🎥',
  },
  [ZentikIcon.MUSIC]: {
    ios: 'music.note',
    web: 'music_note',
    android: '🎵',
  },
  [ZentikIcon.HEADPHONES]: {
    ios: 'headphones',
    web: 'headphones',
    android: '�',
  },
  [ZentikIcon.MIC]: {
    ios: 'mic.fill',
    web: 'mic',
    android: '🎤',
  },
  [ZentikIcon.SPEAKER]: {
    ios: 'speaker.wave.2.fill',
    web: 'volume_up',
    android: '�',
  },
  [ZentikIcon.DOCUMENT]: {
    ios: 'doc.fill',
    web: 'description',
    android: '�',
  },
  [ZentikIcon.FOLDER]: {
    ios: 'folder.fill',
    web: 'folder',
    android: '📁',
  },
  [ZentikIcon.PAPERCLIP]: {
    ios: 'paperclip',
    web: 'attach_file',
    android: '📎',
  },

  // Social & People
  [ZentikIcon.PERSON]: {
    ios: 'person.fill',
    web: 'person',
    android: '�',
  },
  [ZentikIcon.PEOPLE]: {
    ios: 'person.2.fill',
    web: 'people',
    android: '👥',
  },
  [ZentikIcon.HEART]: {
    ios: 'heart.fill',
    web: 'favorite',
    android: '❤️',
  },
  [ZentikIcon.STAR]: {
    ios: 'star.fill',
    web: 'star',
    android: '⭐',
  },
  [ZentikIcon.FLAME]: {
    ios: 'flame.fill',
    web: 'whatshot',
    android: '🔥',
  },

  // Technology & Devices
  [ZentikIcon.PHONE_MOBILE]: {
    ios: 'iphone',
    web: 'smartphone',
    android: '📱',
  },
  [ZentikIcon.COMPUTER]: {
    ios: 'desktopcomputer',
    web: 'computer',
    android: '🖥️',
  },
  [ZentikIcon.LAPTOP]: {
    ios: 'laptopcomputer',
    web: 'laptop',
    android: '💻',
  },
  [ZentikIcon.WIFI]: {
    ios: 'wifi',
    web: 'wifi',
    android: '📶',
  },
  [ZentikIcon.BATTERY]: {
    ios: 'battery.100',
    web: 'battery_full',
    android: '🔋',
  },
  [ZentikIcon.BOLT]: {
    ios: 'bolt.fill',
    web: 'flash_on',
    android: '⚡',
  },
  [ZentikIcon.GEAR]: {
    ios: 'gear',
    web: 'settings',
    android: '⚙️',
  },

  // Weather & Nature
  [ZentikIcon.SUN]: {
    ios: 'sun.max.fill',
    web: 'wb_sunny',
    android: '☀️',
  },
  [ZentikIcon.MOON]: {
    ios: 'moon.fill',
    web: 'nights_stay',
    android: '🌙',
  },
  [ZentikIcon.CLOUD]: {
    ios: 'cloud.fill',
    web: 'cloud',
    android: '☁️',
  },
  [ZentikIcon.RAIN]: {
    ios: 'cloud.rain.fill',
    web: 'water_drop',
    android: '🌧️',
  },
  [ZentikIcon.SNOW]: {
    ios: 'snowflake',
    web: 'ac_unit',
    android: '❄️',
  },

  // Business & Finance
  [ZentikIcon.DOLLAR]: {
    ios: 'dollarsign.circle.fill',
    web: 'attach_money',
    android: '�',
  },
  [ZentikIcon.CREDIT_CARD]: {
    ios: 'creditcard.fill',
    web: 'credit_card',
    android: '�',
  },
  [ZentikIcon.CART]: {
    ios: 'cart.fill',
    web: 'shopping_cart',
    android: '�',
  },
  [ZentikIcon.BAG]: {
    ios: 'bag.fill',
    web: 'shopping_bag',
    android: '🛍️',
  },

  // Health & Fitness
  [ZentikIcon.HEART_PULSE]: {
    ios: 'heart.text.square.fill',
    web: 'favorite',
    android: '💓',
  },
  [ZentikIcon.WALK]: {
    ios: 'figure.walk',
    web: 'directions_walk',
    android: '🚶',
  },
  [ZentikIcon.BICYCLE]: {
    ios: 'bicycle',
    web: 'directions_bike',
    android: '🚴',
  },
  [ZentikIcon.SPORT]: {
    ios: 'sportscourt.fill',
    web: 'sports_soccer',
    android: '⚽',
  },

  // Transportation
  [ZentikIcon.CAR]: {
    ios: 'car.fill',
    web: 'directions_car',
    android: '🚗',
  },
  [ZentikIcon.AIRPLANE]: {
    ios: 'airplane',
    web: 'flight',
    android: '✈️',
  },
  [ZentikIcon.TRAIN]: {
    ios: 'train.side.front.car',
    web: 'train',
    android: '🚆',
  },
  [ZentikIcon.BUS]: {
    ios: 'bus.fill',
    web: 'directions_bus',
    android: '🚌',
  },

  // Food & Drink
  [ZentikIcon.COFFEE]: {
    ios: 'cup.and.saucer.fill',
    web: 'local_cafe',
    android: '☕',
  },
  [ZentikIcon.FOOD]: {
    ios: 'fork.knife',
    web: 'restaurant',
    android: '🍴',
  },

  // Miscellaneous
  [ZentikIcon.LOCK]: {
    ios: 'lock.fill',
    web: 'lock',
    android: '�',
  },
  [ZentikIcon.KEY]: {
    ios: 'key.fill',
    web: 'key',
    android: '🔑',
  },
  [ZentikIcon.TAG]: {
    ios: 'tag.fill',
    web: 'label',
    android: '�️',
  },
  [ZentikIcon.GIFT]: {
    ios: 'gift.fill',
    web: 'card_giftcard',
    android: '🎁',
  },
  [ZentikIcon.FLAG]: {
    ios: 'flag.fill',
    web: 'flag',
    android: '�',
  },
  [ZentikIcon.TRASH]: {
    ios: 'trash.fill',
    web: 'delete',
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
