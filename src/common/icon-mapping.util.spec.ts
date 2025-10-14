import { DevicePlatform } from 'src/users/dto';
import {
  ZentikIcon,
  getIconForPlatform,
  getAllPlatformIcons,
  getAllIconMappings,
  hasIconMapping,
  listAllIcons,
  ZENTIK_ICON_MAPPINGS,
} from './icon-mapping.util';

describe('IconMappingUtil', () => {
  describe('getIconForPlatform', () => {
    it('should return iOS SF Symbol for iOS platform', () => {
      expect(getIconForPlatform(ZentikIcon.BELL, DevicePlatform.IOS)).toBe('bell.fill');
      expect(getIconForPlatform(ZentikIcon.HEART, DevicePlatform.IOS)).toBe('heart.fill');
      expect(getIconForPlatform(ZentikIcon.STAR, DevicePlatform.IOS)).toBe('star.fill');
    });

    it('should return emoji for web platform', () => {
      expect(getIconForPlatform(ZentikIcon.BELL, DevicePlatform.WEB)).toBe('🔔');
      expect(getIconForPlatform(ZentikIcon.HEART, DevicePlatform.WEB)).toBe('❤️');
      expect(getIconForPlatform(ZentikIcon.HOME, DevicePlatform.WEB)).toBe('🏠');
    });

    it('should return emoji for android platform', () => {
      expect(getIconForPlatform(ZentikIcon.BELL, DevicePlatform.ANDROID)).toBe('🔔');
      expect(getIconForPlatform(ZentikIcon.HEART, DevicePlatform.ANDROID)).toBe('❤️');
      expect(getIconForPlatform(ZentikIcon.STAR, DevicePlatform.ANDROID)).toBe('⭐');
    });
  });

  describe('getAllPlatformIcons', () => {
    it('should return all platform icons for a Zentik icon', () => {
      const bellIcons = getAllPlatformIcons(ZentikIcon.BELL);
      expect(bellIcons).toBeDefined();
      expect(bellIcons?.ios).toBe('bell.fill');
      expect(bellIcons?.web).toBe('🔔');
      expect(bellIcons?.android).toBe('🔔');
    });

    it('should return platform icons for different icon types', () => {
      const heartIcons = getAllPlatformIcons(ZentikIcon.HEART);
      expect(heartIcons?.ios).toBe('heart.fill');
      expect(heartIcons?.web).toBe('❤️');
      expect(heartIcons?.android).toBe('❤️');

      const homeIcons = getAllPlatformIcons(ZentikIcon.HOME);
      expect(homeIcons?.ios).toBe('house.fill');
      expect(homeIcons?.web).toBe('🏠');
      expect(homeIcons?.android).toBe('🏠');
    });
  });

  describe('getAllIconMappings', () => {
    it('should return all icon mappings', () => {
      const mappings = getAllIconMappings();
      expect(mappings).toBeDefined();
      expect(typeof mappings).toBe('object');
      expect(Object.keys(mappings).length).toBeGreaterThan(0);
    });

    it('should return the same object as ZENTIK_ICON_MAPPINGS', () => {
      const mappings = getAllIconMappings();
      expect(mappings).toBe(ZENTIK_ICON_MAPPINGS);
    });

    it('should contain expected icon categories', () => {
      const mappings = getAllIconMappings();

      // Communication & Alerts
      expect(mappings[ZentikIcon.BELL].android).toBe('🔔');
      expect(mappings[ZentikIcon.ENVELOPE].android).toBe('✉️');
      expect(mappings[ZentikIcon.MESSAGE].android).toBe('💬');

      // Status & Actions
      expect(mappings[ZentikIcon.CHECKMARK].android).toBe('✅');
      expect(mappings[ZentikIcon.XMARK].android).toBe('❌');
      expect(mappings[ZentikIcon.EXCLAMATION].android).toBe('⚠️');

      // Social & People
      expect(mappings[ZentikIcon.PERSON].android).toBe('👤');
      expect(mappings[ZentikIcon.HEART].android).toBe('❤️');
      expect(mappings[ZentikIcon.STAR].android).toBe('⭐');
    });
  });

  describe('hasIconMapping', () => {
    it('should return true for existing Zentik icons', () => {
      expect(hasIconMapping(ZentikIcon.BELL)).toBe(true);
      expect(hasIconMapping(ZentikIcon.HEART)).toBe(true);
      expect(hasIconMapping(ZentikIcon.STAR)).toBe(true);
      expect(hasIconMapping(ZentikIcon.CLOCK)).toBe(true);
    });
  });

  describe('listAllIcons', () => {
    it('should return all available Zentik icons', () => {
      const icons = listAllIcons();
      expect(icons).toBeDefined();
      expect(Array.isArray(icons)).toBe(true);
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should include expected icon names', () => {
      const icons = listAllIcons();
      expect(icons).toContain(ZentikIcon.BELL);
      expect(icons).toContain(ZentikIcon.HEART);
      expect(icons).toContain(ZentikIcon.STAR);
      expect(icons).toContain(ZentikIcon.HOME);
    });
  });

  describe('Icon mapping completeness', () => {
    it('should have at least 50 icon mappings', () => {
      const mappings = getAllIconMappings();
      expect(Object.keys(mappings).length).toBeGreaterThanOrEqual(50);
    });

    it('should have all platform mappings for each icon', () => {
      const mappings = getAllIconMappings();
      Object.entries(mappings).forEach(([key, value]) => {
        expect(value.ios).toBeDefined();
        expect(value.web).toBeDefined();
        expect(value.android).toBeDefined();
        expect(typeof value.ios).toBe('string');
        expect(typeof value.web).toBe('string');
        expect(typeof value.android).toBe('string');
      });
    });
  });

  describe('Common use cases', () => {
    it('should handle notification bell icons across platforms', () => {
      expect(getIconForPlatform(ZentikIcon.BELL, DevicePlatform.IOS)).toBe('bell.fill');
      expect(getIconForPlatform(ZentikIcon.BELL, DevicePlatform.WEB)).toBe('🔔');
      expect(getIconForPlatform(ZentikIcon.BELL, DevicePlatform.ANDROID)).toBe('🔔');
    });

    it('should handle status icons across platforms', () => {
      expect(getIconForPlatform(ZentikIcon.CHECKMARK, DevicePlatform.ANDROID)).toBe('✅');
      expect(getIconForPlatform(ZentikIcon.XMARK, DevicePlatform.ANDROID)).toBe('❌');
      expect(getIconForPlatform(ZentikIcon.EXCLAMATION, DevicePlatform.ANDROID)).toBe('⚠️');
      expect(getIconForPlatform(ZentikIcon.INFO, DevicePlatform.ANDROID)).toBe('ℹ️');
    });

    it('should handle social icons across platforms', () => {
      expect(getIconForPlatform(ZentikIcon.HEART, DevicePlatform.IOS)).toBe('heart.fill');
      expect(getIconForPlatform(ZentikIcon.HEART, DevicePlatform.WEB)).toBe('❤️');
      expect(getIconForPlatform(ZentikIcon.HEART, DevicePlatform.ANDROID)).toBe('❤️');

      expect(getIconForPlatform(ZentikIcon.STAR, DevicePlatform.ANDROID)).toBe('⭐');
      expect(getIconForPlatform(ZentikIcon.PERSON, DevicePlatform.ANDROID)).toBe('👤');
    });

    it('should handle technology icons across platforms', () => {
      expect(getIconForPlatform(ZentikIcon.PHONE_MOBILE, DevicePlatform.ANDROID)).toBe(
        '📱',
      );
      expect(getIconForPlatform(ZentikIcon.LAPTOP, DevicePlatform.ANDROID)).toBe('💻');
      expect(getIconForPlatform(ZentikIcon.WIFI, DevicePlatform.ANDROID)).toBe('📶');
      expect(getIconForPlatform(ZentikIcon.BOLT, DevicePlatform.ANDROID)).toBe('⚡');
    });
  });
});
