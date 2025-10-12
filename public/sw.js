// sw-template.js

// Importa le librerie di Workbox (verranno caricate da CDN)
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Questo è un segnaposto. Workbox CLI lo sostituirà con l'elenco dei file da precache.
// NON MODIFICARE QUESTA LINEA
workbox.precaching.precacheAndRoute([{"revision":"09f59529c1d428142cc9add6ae66220c","url":"_expo/static/css/modal.module-09f59529c1d428142cc9add6ae66220c.css"},{"revision":"7e8b32cffca41c2337a81d03f00ccd6b","url":"_expo/static/js/web/entry-431781f1912e2c0e2e66fc4ba52a4238.js"},{"revision":"5c95824019120f404f55f482f9e28022","url":"_expo/static/js/web/worker-5c95824019120f404f55f482f9e28022.js"},{"revision":"1183aff29abb3db1ad476b436a928a18","url":"_sitemap.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/backup-management.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/events-review.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/index.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/oauth-providers/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/oauth-providers/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/oauth-providers/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/server-logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/server-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/system-access-tokens/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/system-access-tokens/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/system-access-tokens/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/user-management/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(admin)/user-management/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(auth)/+not-found.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(auth)/app-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(auth)/confirm-email.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(auth)/email-confirmation.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(auth)/forgot-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(auth)/login.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(auth)/oauth.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(auth)/register.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/(auth)/+not-found.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/(auth)/app-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/(auth)/confirm-email.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/(auth)/email-confirmation.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/(auth)/forgot-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/(auth)/login.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/(auth)/oauth.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/(auth)/register.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/+not-found.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/app-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/confirm-email.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/email-confirmation.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/forgot-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/login.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/oauth.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/register.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(common)/terms-acceptance.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/(tabs)/buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/(tabs)/gallery.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/(tabs)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/bucket/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/bucket/link/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/bucket/settings/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/bucket/settings/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/gallery.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/notification/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(home)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/backup-management.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/events-review.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/index.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/oauth-providers/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/oauth-providers/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/oauth-providers/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/server-logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/server-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/system-access-tokens/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/system-access-tokens/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/system-access-tokens/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/user-management/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(admin)/user-management/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/(tabs)/buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/(tabs)/gallery.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/(tabs)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/bucket/link/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/bucket/settings/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/bucket/settings/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/gallery.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/notification/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(home)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/access-token/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/access-token/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/app-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/bucket/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/bucket/link/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/bucket/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/dangling-bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/devices.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/index.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/payload-mapper/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/payload-mapper/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/payload-mapper/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/user-sessions.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/user/attachments.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/user/change-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/user/profile.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/webhook/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/webhook/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(settings)/webhook/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(tabs)/buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(tabs)/gallery.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/(tabs)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/access-token/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/access-token/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/app-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/backup-management.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/bucket/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/bucket/link/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/bucket/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/bucket/settings/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/bucket/settings/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/dangling-bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/devices.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/events-review.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/gallery.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/index.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/notification/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/oauth-providers/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/oauth-providers/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/oauth-providers/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/payload-mapper/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/payload-mapper/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/payload-mapper/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/server-logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/server-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/system-access-tokens/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/system-access-tokens/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/system-access-tokens/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/user-management/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/user-management/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/user-sessions.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/user/attachments.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/user/change-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/user/profile.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/webhook/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/webhook/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(mobile)/webhook/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/access-token/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/access-token/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/app-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/bucket/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/bucket/link/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/bucket/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/dangling-bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/devices.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/index.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/payload-mapper/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/payload-mapper/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/payload-mapper/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/user-sessions.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/user/attachments.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/user/change-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/user/profile.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/webhook/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/webhook/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(settings)/webhook/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/backup-management.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/events-review.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/index.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/oauth-providers/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/oauth-providers/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/oauth-providers/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/server-logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/server-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/system-access-tokens/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/system-access-tokens/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/system-access-tokens/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/user-management/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(admin)/user-management/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(home)/bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(home)/bucket/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(home)/bucket/link/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(home)/bucket/settings/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(home)/bucket/settings/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(home)/buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(home)/gallery.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(home)/notification/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(home)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/access-token/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/access-token/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/app-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/bucket/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/bucket/link/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/bucket/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/devices.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/index.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/payload-mapper/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/payload-mapper/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/payload-mapper/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/user-sessions.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/user/attachments.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/user/change-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/user/profile.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/webhook/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/webhook/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/(settings)/webhook/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/access-token/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/access-token/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/app-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/backup-management.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/bucket/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/bucket/link/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/bucket/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/bucket/settings/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/bucket/settings/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/devices.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/events-review.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/gallery.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/index.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/notification/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/oauth-providers/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/oauth-providers/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/oauth-providers/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/payload-mapper/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/payload-mapper/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/payload-mapper/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/server-logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/server-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/system-access-tokens/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/system-access-tokens/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/system-access-tokens/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/user-management/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/user-management/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/user-sessions.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/user/attachments.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/user/change-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/user/profile.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/webhook/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/webhook/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tablet)/webhook/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tabs)/buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tabs)/gallery.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"(tabs)/notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"+not-found.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"access-token/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"access-token/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"app-settings.html"},{"revision":"49a79d66bdea2debf1832bf4d7aca127","url":"assets/assets/fonts/SpaceMono-Regular.49a79d66bdea2debf1832bf4d7aca127.ttf"},{"revision":"6c2ef16e84be3361cb27136f7ce756a7","url":"assets/assets/icons/icon-512x512.6c2ef16e84be3361cb27136f7ce756a7.png"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"backup-management.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"bucket/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"bucket/link/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"bucket/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"bucket/settings/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"bucket/settings/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"buckets.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"confirm-email.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"dangling-bucket/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"devices.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"email-confirmation.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"events-review.html"},{"revision":"fc08af8dc9c028408f0f889f6df2783c","url":"favicon.ico"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"forgot-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"gallery.html"},{"revision":"b67a6fba2a0af90433e205969c21d776","url":"icon-128x128.png"},{"revision":"456d1ac568ae128769e259b6c7a14c64","url":"icon-16x16.png"},{"revision":"0c197e5ea9626cb48f2147557d4cb290","url":"icon-32x32.png"},{"revision":"3d2410c1fd69c2962badf79d398070bd","url":"icon-48x48.png"},{"revision":"d15f8713938fbe359fb08085333757a2","url":"icon-96x96.png"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"index.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"login.html"},{"revision":"e184928be4babf681d96b70684437b95","url":"logo192.png"},{"revision":"6c2ef16e84be3361cb27136f7ce756a7","url":"logo512.png"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"notification/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"notifications.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"oauth-providers/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"oauth-providers/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"oauth-providers/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"oauth.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"payload-mapper/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"payload-mapper/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"payload-mapper/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"register.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"server-logs.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"server-settings.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"system-access-tokens/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"system-access-tokens/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"system-access-tokens/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"terms-acceptance.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"user-management/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"user-management/list.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"user-sessions.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"user/attachments.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"user/change-password.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"user/profile.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"webhook/[id].html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"webhook/create.html"},{"revision":"d67b162ae28e035dd9906c52b7789596","url":"webhook/list.html"},{"revision":"ff37499fa90b195adb27b78fe86d4c3d","url":"manifest.json"}]);

// --- LOGICA PER LE NOTIFICHE PUSH ---

// Common IndexedDB helper function
async function withIndexedDB(successCallback, mode = 'readonly', storeName = 'keyvalue') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('zentik-storage', 7);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);
      try {
        successCallback(store, resolve, reject);
      } catch (error) {
        reject(error);
      }
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('keyvalue')) {
        db.createObjectStore('keyvalue');
      }
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications');
      }
      if (!db.objectStoreNames.contains('media_item')) {
        db.createObjectStore('media_item');
      }
      if (!db.objectStoreNames.contains('cache_item')) {
        db.createObjectStore('cache_item');
      }
    };
  });
}

// IndexedDB helper for service worker
async function storeIntentInIndexedDB(intentData) {
  return withIndexedDB((store, resolve, reject) => {
    const putRequest = store.put(JSON.stringify(intentData), 'pending_navigation_intent');

    putRequest.onsuccess = () => resolve();
    putRequest.onerror = () => reject(putRequest.error);
  }, 'readwrite');
}

// Priority order for media types: IMAGE > GIF > VIDEO > AUDIO
function getMediaTypePriority(mediaType) {
  const priorities = {
    'IMAGE': 1,
    'GIF': 2,
    'VIDEO': 3,
    'AUDIO': 4
  };
  return priorities[mediaType?.toUpperCase()] || 999;
}

// Select the first attachment based on priority
function selectFirstAttachmentForPrefetch(attachmentData) {
  // Filter out invalid attachments
  console.log('[Service Worker] Selecting first attachment for prefetch:', attachmentData);
  const validAttachments = attachmentData.filter(attachment =>
    attachment &&
    attachment.url &&
    attachment.mediaType &&
    typeof attachment.url === 'string' &&
    attachment.url.startsWith('http')
  );

  if (validAttachments.length === 0) {
    return null;
  }

  // Sort by priority and return the first one
  validAttachments.sort((a, b) => {
    const priorityA = getMediaTypePriority(a.mediaType);
    const priorityB = getMediaTypePriority(b.mediaType);
    return priorityA - priorityB;
  });

  return validAttachments[0];
}

// Generate cache key for cache_item table - must match React app implementation
function generateCacheItemKey(url, mediaType) {
  return `${String(mediaType).toUpperCase()}_${url}`;
}

// Generate cache key for media_item table - must match React app implementation
function generateMediaCacheKey(url, mediaType) {
  // Generate hash like React app does
  function generateLongHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash * 31 + char) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  // Get file extension like React app does
  function getFileExtension(url, mediaType) {
    switch (mediaType) {
      case 'VIDEO':
        return 'mp4';
      case 'IMAGE':
        return 'jpg';
      case 'GIF':
        return 'gif';
      case 'AUDIO':
        return 'mp3';
      default:
        return 'jpg';
    }
  }

  const hash = generateLongHash(url);
  const safeFileName = `${String(mediaType).toLowerCase()}_${hash}`;
  const extension = getFileExtension(url, mediaType);
  return `${String(mediaType).toUpperCase()}/${safeFileName}.${extension}`;
}

// Prefetch media attachment and save to IndexedDB
async function prefetchMediaAttachment(attachment, notificationId) {
  if (!attachment || !attachment.url || !attachment.mediaType) {
    console.log('[Service Worker] Invalid attachment for prefetch:', attachment);
    return null;
  }

  const { url, mediaType } = attachment;
  const cacheItemKey = generateCacheItemKey(url, mediaType);
  const mediaItemKey = generateMediaCacheKey(url, mediaType);

  console.log(`[Service Worker] Prefetching media attachment: ${mediaType} from ${url}`);
  console.log(`[Service Worker] Cache item key: ${cacheItemKey}`);
  console.log(`[Service Worker] Media item key: ${mediaItemKey}`);

  try {
    // Use backend proxy to fetch the media data (bypasses CORS)
    const credentials = await getApiCredentials();
    if (!credentials) {
      throw new Error('No API credentials available for media proxy');
    }

    const proxyUrl = `${credentials.apiEndpoint}/api/v1/attachments/proxy-media?url=${encodeURIComponent(url)}`;
    console.log(`[Service Worker] Using backend proxy for media: ${proxyUrl}`);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${credentials.authToken}`,
        'Accept': 'image/*,video/*,audio/*,*/*',
        'User-Agent': 'Zentik-Notifier-ServiceWorker/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend proxy failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const size = arrayBuffer.byteLength;

    console.log(`[Service Worker] Media downloaded: ${size} bytes from ${url}`);

    // Save to media_item table in IndexedDB with media_item key
    await saveMediaItemToIndexedDB(mediaItemKey, arrayBuffer);

    // Update cache_item with download status using cache_item key and media_item key as localPath
    await updateCacheItemForPrefetch(cacheItemKey, url, mediaType, size, notificationId, undefined, mediaItemKey);

    console.log(`[Service Worker] Media prefetched successfully: ${mediaItemKey}`);
    
    // Log successful prefetch
    if (notificationId) {
      logToDatabase(
        'INFO',
        'ServiceWorker',
        '[Media] Media prefetched successfully',
        {
          notificationId: notificationId,
          mediaType: mediaType,
          url: url,
          size: size
        }
      ).catch(e => console.error('[Service Worker] Failed to log prefetch:', e));
    }
    
    return { cacheKey: cacheItemKey, mediaKey: mediaItemKey, size, mediaType };

  } catch (error) {
    console.error(`[Service Worker] Failed to prefetch media attachment:`, error);
    
    // Log prefetch error
    if (notificationId) {
      logToDatabase(
        'ERROR',
        'ServiceWorker',
        '[Media] Failed to prefetch media',
        {
          notificationId: notificationId,
          mediaType: mediaType,
          url: url,
          error: error.message || String(error)
        }
      ).catch(e => console.error('[Service Worker] Failed to log prefetch error:', e));
    }
    
    // Update cache item with error status
    await updateCacheItemForPrefetch(cacheItemKey, url, mediaType, 0, notificationId, error.message);
    throw error;
  }
}

// Save media item to IndexedDB media_item table
async function saveMediaItemToIndexedDB(key, data) {
  return withIndexedDB((store, resolve, reject) => {
    const mediaItem = {
      key,
      data,
    };

    const putRequest = store.put(mediaItem, key);

    putRequest.onsuccess = () => {
      console.log(`[Service Worker] Media item saved to IndexedDB: ${key}`);
      resolve();
    };
    putRequest.onerror = () => reject(putRequest.error);
  }, 'readwrite', 'media_item');
}

// Update cache_item table for prefetched media
async function updateCacheItemForPrefetch(key, url, mediaType, size, notificationId, errorCode = undefined, localPath = undefined) {
  return withIndexedDB((store, resolve, reject) => {
    const cacheItem = {
      key,
      url,
      localPath: localPath, // The media_item key that contains the actual data
      localThumbPath: undefined,
      generatingThumbnail: false,
      timestamp: Date.now(),
      size,
      mediaType,
      originalFileName: undefined,
      downloadedAt: errorCode ? undefined : Date.now(),
      notificationDate: Date.now(),
      isDownloading: false,
      isPermanentFailure: !!errorCode,
      isUserDeleted: false,
      errorCode,
      notificationId
    };

    const putRequest = store.put(cacheItem, key);

    putRequest.onsuccess = () => {
      console.log(`[Service Worker] Cache item updated for prefetch: ${key}`);
      resolve();
    };
    putRequest.onerror = () => reject(putRequest.error);
  }, 'readwrite', 'cache_item');
}

// Validate notification structure
function isValidNotification(notification) {
  try {
    // Check required top-level properties
    if (!notification || typeof notification !== 'object') {
      return false;
    }

    if (!notification.id || typeof notification.id !== 'string') {
      return false;
    }

    if (!notification.createdAt || typeof notification.createdAt !== 'string') {
      return false;
    }

    // readAt can be null/undefined (unread notifications)
    if (notification.readAt !== null && notification.readAt !== undefined && typeof notification.readAt !== 'string') {
      return false;
    }

    // Check required message object
    if (!notification.message || typeof notification.message !== 'object') {
      return false;
    }

    // Check required bucket object inside message
    if (!notification.message.bucket || typeof notification.message.bucket !== 'object') {
      return false;
    }

    if (!notification.message.bucket.id || typeof notification.message.bucket.id !== 'string') {
      return false;
    }

    // All essential properties are present and valid
    return true;
  } catch (error) {
    console.error('[Service Worker] [isValidNotification] Validation error:', error);
    return false;
  }
}

// Save notification to IndexedDB notifications table (same format as notification-repository)
async function storePendingNotification(notificationData) {
  try {
    const now = new Date().toISOString();
    
    // Build NotificationFragment
    const notificationFragment = {
      __typename: 'Notification',
      id: notificationData.notificationId,
      receivedAt: now,
      readAt: null,
      sentAt: now,
      createdAt: now,
      updatedAt: now,
      message: {
        __typename: 'Message',
        id: notificationData.notificationId, // Use same ID for message
        title: notificationData.title || '',
        body: notificationData.body || null,
        subtitle: notificationData.subtitle || null,
        sound: 'default',
        deliveryType: notificationData.deliveryType || 'PUSH',
        locale: null,
        snoozes: null,
        createdAt: now,
        updatedAt: now,
        attachments: (notificationData.attachmentData || []).map(att => ({
          __typename: 'MessageAttachment',
          mediaType: att.mediaType?.toUpperCase() || 'IMAGE',
          url: att.url || null,
          name: att.name || null,
          attachmentUuid: att.attachmentUuid || null,
          saveOnServer: att.saveOnServer !== undefined ? att.saveOnServer : null
        })),
        tapAction: notificationData.tapAction ? {
          __typename: 'NotificationAction',
          type: notificationData.tapAction.type?.toUpperCase() || 'OPEN_NOTIFICATION',
          value: notificationData.tapAction.value || null,
          title: notificationData.tapAction.title || null,
          icon: notificationData.tapAction.icon || null,
          destructive: notificationData.tapAction.destructive || false
        } : null,
        actions: (notificationData.actions || []).map(action => ({
          __typename: 'NotificationAction',
          type: action.type?.toUpperCase() || 'CUSTOM',
          value: action.value || null,
          title: action.title || null,
          icon: action.icon || null,
          destructive: action.destructive || false
        })),
        bucket: {
          __typename: 'Bucket',
          id: notificationData.bucketId || 'default',
          name: notificationData.bucketName || 'Default',
          description: null,
          color: null,
          icon: notificationData.bucketIconUrl || null,
          createdAt: now,
          updatedAt: now,
          isProtected: null,
          isPublic: null
        }
      }
    };
    
    // Validate notification before saving
    if (!isValidNotification(notificationFragment)) {
      console.error('[Service Worker] ❌ Invalid notification structure, not saving:', {
        id: notificationFragment?.id || 'unknown',
        hasMessage: !!notificationFragment?.message,
        hasBucket: !!notificationFragment?.message?.bucket,
        hasCreatedAt: !!notificationFragment?.createdAt,
      });
      
      // Log validation failure
      logToDatabase(
        'ERROR',
        'ServiceWorker',
        '[Database] Invalid notification structure',
        {
          notificationId: notificationFragment?.id || 'unknown',
          bucketId: notificationData?.bucketId
        }
      ).catch(e => console.error('[Service Worker] Failed to log validation error:', e));
      
      throw new Error('Invalid notification structure');
    }
    
    // Prepare data for database
    const dbData = {
      id: notificationFragment.id,
      created_at: notificationFragment.createdAt,
      read_at: notificationFragment.readAt,
      bucket_id: notificationFragment.message.bucket.id,
      has_attachments: notificationFragment.message.attachments && notificationFragment.message.attachments.length > 0 ? 1 : 0,
      fragment: JSON.stringify(notificationFragment)
    };
    
    // Save to IndexedDB notifications table
    await withIndexedDB((store, resolve, reject) => {
      const putRequest = store.put(dbData, dbData.id);
      putRequest.onsuccess = () => {
        console.log('[Service Worker] ✅ Notification saved to IndexedDB:', dbData.id);
        
        // Log successful save
        logToDatabase(
          'INFO',
          'ServiceWorker',
          '[Database] Notification saved to IndexedDB',
          {
            notificationId: dbData.id,
            bucketId: dbData.bucket_id,
            hasAttachments: dbData.has_attachments === 1
          }
        ).catch(e => console.error('[Service Worker] Failed to log save:', e));
        
        resolve();
      };
      putRequest.onerror = () => reject(putRequest.error);
    }, 'readwrite', 'notifications');
    
  } catch (error) {
    console.error('[Service Worker] Failed to save notification to IndexedDB:', error);
    
    // Log error
    logToDatabase(
      'ERROR',
      'ServiceWorker',
      '[Database] Failed to save notification',
      {
        notificationId: notificationData.notificationId,
        error: error.message || String(error)
      }
    ).catch(e => console.error('[Service Worker] Failed to log error:', e));
    
    throw error;
  }
}

// Common method to handle notification actions (used by both tapAction and action buttons)
async function handleNotificationAction(actionType, actionValue, notificationData, event) {
  console.log('[Service Worker] Handling action:', actionType, actionValue);

  const notificationId = notificationData?.notificationId;
  const bucketId = notificationData?.bucketId;
  
  // Log action handling
  if (notificationId) {
    logToDatabase(
      'INFO',
      'ServiceWorker',
      '[Action] Handling notification action',
      {
        notificationId: notificationId,
        actionType: actionType,
        actionValue: actionValue
      }
    ).catch(e => console.error('[Service Worker] Failed to log action:', e));
  }

  switch (actionType) {
    case 'NAVIGATE':
      // Navigate to external URL or internal route
      event.waitUntil(
        (async () => {
          try {
            const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            if (clientList.length > 0) {
              // App is open, send navigation message
              const focusedClient = clientList.find(client => client.focused) || clientList[0];
              focusedClient.postMessage({
                type: 'notification-tap-action',
                action: 'NAVIGATE',
                value: actionValue,
                notificationId: notificationId,
                bucketId: bucketId,
                data: notificationData
              });
              await focusedClient.focus();
            } else {
              // App not open, handle external vs internal URLs
              const isExternalUrl = actionValue.startsWith('http://') || actionValue.startsWith('https://');

              if (isExternalUrl) {
                // For external URLs, open in new tab/window
                console.log('[Service Worker] Opening external URL:', actionValue);
                if (self.clients.openWindow) {
                  try {
                    await self.clients.openWindow(actionValue);
                  } catch (error) {
                    console.error('[Service Worker] Failed to open external URL:', error);
                    // Fallback: open app and send message
                    const newClient = await self.clients.openWindow('/');
                    if (newClient) {
                      setTimeout(() => {
                        newClient.postMessage({
                          type: 'notification-tap-action',
                          action: 'NAVIGATE',
                          value: actionValue,
                          notificationId: notificationId,
                          bucketId: bucketId,
                          data: notificationData
                        });
                      }, 1000);
                    }
                  }
                }
              } else {
                // For internal routes, store intent and open app
                console.log('[Service Worker] Storing navigation intent:', actionValue);
                if (self.clients.openWindow) {
                  // Store navigation intent
                  const intentData = {
                    type: 'NAVIGATE',
                    value: actionValue,
                    notificationId: notificationId,
                    bucketId: bucketId,
                    timestamp: Date.now()
                  };

                  try {
                    await storeIntentInIndexedDB(intentData);
                    console.log('[Service Worker] Stored navigation intent:', intentData);
                    // Open app and let it handle the intent from IndexedDB
                    await self.clients.openWindow('/');
                  } catch (error) {
                    console.error('[Service Worker] Failed to store intent:', error);
                    // Still open app even if storage fails
                    await self.clients.openWindow('/');
                  }
                }
              }
            }
          } catch (error) {
            console.error('[Service Worker] Error in NAVIGATE action:', error);
          }
        })()
      );
      break;

    case 'OPEN_NOTIFICATION':
      // Open notification detail page
      const value = actionValue || notificationId;
      event.waitUntil(
        (async () => {
          try {
            const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            if (clientList.length > 0) {
              const focusedClient = clientList.find(client => client.focused) || clientList[0];
              focusedClient.postMessage({
                type: 'notification-tap-action',
                action: 'OPEN_NOTIFICATION',
                value: notificationId,
                notificationId: notificationId,
                bucketId: bucketId,
                data: notificationData
              });
              await focusedClient.focus();
            } else {
              // App is closed, store intent and open app
              if (self.clients.openWindow) {
                // Store the notification intent
                const intentData = {
                  type: 'OPEN_NOTIFICATION',
                  notificationId: notificationId,
                  value: notificationId,
                  bucketId: bucketId,
                  timestamp: Date.now()
                };

                try {
                  await storeIntentInIndexedDB(intentData);
                  console.log('[Service Worker] Stored notification intent:', intentData);
                  // Open app and let it handle the intent from IndexedDB
                  await self.clients.openWindow('/');
                } catch (error) {
                  console.error('[Service Worker] Failed to store intent:', error);
                  // Still open app even if storage fails
                  await self.clients.openWindow('/');
                }
              }
            }
          } catch (error) {
            console.error('[Service Worker] Error in OPEN_NOTIFICATION action:', error);
          }
        })()
      );
      break;

    case 'BACKGROUND_CALL':
      // Execute background API call
      event.waitUntil(
        (async () => {
          try {
            const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            if (clientList.length > 0) {
              // App is open, send message to app
              const focusedClient = clientList.find(client => client.focused) || clientList[0];
              focusedClient.postMessage({
                type: 'notification-tap-action',
                action: 'BACKGROUND_CALL',
                value: actionValue,
                notificationId: notificationId,
                bucketId: bucketId,
                data: notificationData
              });
              await focusedClient.focus();
            } else {
              // App is closed, execute background call directly
              const [method, url] = actionValue.split('::');

              if (!url) {
                console.error('[Service Worker] ❌ Invalid background call format:', actionValue);
                return;
              }

              console.log(`[Service Worker] 📞 Executing background call: ${method || 'GET'} ${url}`);

              try {
                const response = await fetch(url, {
                  method: method || 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                });

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                console.log('[Service Worker] ✅ Background call executed successfully');
              } catch (error) {
                console.error('[Service Worker] ❌ Failed to execute background call:', error);
              }
            }
          } catch (error) {
            console.error('[Service Worker] Error in BACKGROUND_CALL action:', error);
          }
        })()
      );
      break;

    case 'MARK_AS_READ':
      // Mark notification as read
      event.waitUntil(
        (async () => {
          try {
            // First, update local IndexedDB (optimistic update)
            try {
              const db = await indexedDB.open('zentik-storage', 7);
              await new Promise((resolve, reject) => {
                db.onsuccess = async () => {
                  const database = db.result;
                  const tx = database.transaction(['notifications'], 'readwrite');
                  const store = tx.objectStore('notifications');
                  
                  // Get the notification
                  const getRequest = store.get(notificationId);
                  getRequest.onsuccess = () => {
                    const notification = getRequest.result;
                    if (notification) {
                      // Update read_at timestamp
                      notification.read_at = new Date().toISOString();
                      
                      // Update the notification in the store
                      const putRequest = store.put(notification, notificationId);
                      putRequest.onsuccess = () => {
                        console.log('[Service Worker] ✅ Updated read_at in IndexedDB:', notificationId);
                        resolve();
                      };
                      putRequest.onerror = () => reject(putRequest.error);
                    } else {
                      console.warn('[Service Worker] Notification not found in IndexedDB:', notificationId);
                      resolve();
                    }
                  };
                  getRequest.onerror = () => reject(getRequest.error);
                };
                db.onerror = () => reject(db.error);
              });
            } catch (dbError) {
              console.warn('[Service Worker] ⚠️ Failed to update IndexedDB:', dbError);
              // Continue with API call even if local update fails
            }

            // Then, call the API
            await executeApiCall(`/notifications/${notificationId}/read`, 'PATCH');
            console.log('[Service Worker] ✅ Notification marked as read on server:', notificationId);
            
            // Log success
            logToDatabase(
              'INFO',
              'ServiceWorker',
              '[MarkAsRead] Notification marked as read',
              { notificationId: notificationId }
            ).catch(e => console.error('[Service Worker] Failed to log mark as read:', e));

            // Notify app to invalidate queries
            const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            if (clientList.length > 0) {
              const focusedClient = clientList.find(client => client.focused) || clientList[0];
              focusedClient.postMessage({
                type: 'notification-action-completed',
                action: 'MARK_AS_READ',
                notificationId: notificationId,
                success: true,
                invalidateQueries: true // Signal to invalidate React Query cache
              });
            }
          } catch (error) {
            console.error('[Service Worker] ❌ Failed to mark notification as read:', error);
            
            // Log error
            logToDatabase(
              'ERROR',
              'ServiceWorker',
              '[MarkAsRead] Failed to mark notification as read',
              {
                notificationId: notificationId,
                error: error.message || String(error)
              }
            ).catch(e => console.error('[Service Worker] Failed to log error:', e));
          }
        })()
      );
      break;

    case 'DELETE':
      // Delete notification
      event.waitUntil(
        (async () => {
          try {
            await executeApiCall(`/notifications/${notificationId}`, 'DELETE');
            console.log('[Service Worker] ✅ Notification deleted from server:', notificationId);

            // Remove from local IndexedDB notifications table
            try {
              await withIndexedDB((store, resolve, reject) => {
                const deleteRequest = store.delete(notificationId);
                deleteRequest.onsuccess = () => {
                  console.log('[Service Worker] ✅ Notification removed from IndexedDB:', notificationId);
                  
                  // Log deletion
                  logToDatabase(
                    'INFO',
                    'ServiceWorker',
                    '[Delete] Notification deleted from database',
                    { notificationId: notificationId }
                  ).catch(e => console.error('[Service Worker] Failed to log deletion:', e));
                  
                  resolve();
                };
                deleteRequest.onerror = () => reject(deleteRequest.error);
              }, 'readwrite', 'notifications');
            } catch (error) {
              console.error('[Service Worker] ⚠️ Failed to remove notification from IndexedDB:', error);
            }

            // Notify app to invalidate queries
            const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            if (clientList.length > 0) {
              const focusedClient = clientList.find(client => client.focused) || clientList[0];
              focusedClient.postMessage({
                type: 'notification-action-completed',
                action: 'DELETE',
                notificationId: notificationId,
                success: true,
                invalidateQueries: true // Signal to invalidate React Query cache
              });
            }
          } catch (error) {
            console.error('[Service Worker] ❌ Failed to delete notification:', error);
            
            // Log error
            logToDatabase(
              'ERROR',
              'ServiceWorker',
              '[Delete] Failed to delete notification',
              {
                notificationId: notificationId,
                error: error.message || String(error)
              }
            ).catch(e => console.error('[Service Worker] Failed to log error:', e));
          }
        })()
      );
      break;

    case 'SNOOZE': {
      const minutes = parseInt(actionValue, 10);
      if (isNaN(minutes) || minutes <= 0) {
        console.error('[Service Worker] ❌ Invalid snooze duration:', actionValue);
        return;
      }

      event.waitUntil(
        (async () => {
          try {
            await executeApiCall(`/buckets/${bucketId}/snooze-minutes`, 'POST', { minutes });
            console.log(`[Service Worker] ✅ Bucket ${bucketId} snoozed for ${minutes} minutes`);
          } catch (error) {
            console.error('[Service Worker] ❌ Failed to snooze bucket:', error);
          }
        })()
      );
      break;
    }

    case 'WEBHOOK':
      event.waitUntil(
        (async () => {
          try {
            await executeApiCall(`/webhooks/${actionValue}/execute`, 'POST');
            console.log('[Service Worker] ✅ Webhook executed:', actionValue);
          } catch (error) {
            console.error('[Service Worker] ❌ Failed to execute webhook:', error);
          }
        })()
      );
      break;

    default:
      console.warn('[Service Worker] Unknown action type:', actionType);
      // Fallback to default URL navigation
      event.waitUntil(
        (async () => {
          try {
            const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            if (clientList.length > 0) {
              const focusedClient = clientList.find(client => client.focused) || clientList[0];
              focusedClient.postMessage({
                type: 'notification-click',
                url: actionValue || '/',
                notificationId: notificationId,
                bucketId: bucketId,
                data: notificationData
              });
              await focusedClient.focus();
            } else {
              if (self.clients.openWindow) {
                // Try to open the actionValue if it's a valid URL, otherwise fallback to '/'
                const fallbackUrl = actionValue || '/';
                try {
                  await self.clients.openWindow(fallbackUrl);
                } catch (error) {
                  console.error('[Service Worker] Failed to open fallback URL:', error);
                  await self.clients.openWindow('/');
                }
              }
            }
          } catch (error) {
            console.error('[Service Worker] Error in default action:', error);
          }
        })()
      );
  }
}

self.addEventListener('push', (event) => {
  let payload;
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      console.error('[Service Worker] Failed to parse push data:', e);
      payload = {};
    }
  } else {
    payload = {};
  }

  console.log('[Service Worker] Push Received:', payload);

  const title = payload.title || 'Zentik';
  const body = payload.body || '';
  const url = payload.url || '/';
  const notificationId = payload.notificationId;
  const bucketId = payload.bucketId;
  const actions = payload.actions || [];
  
  // Log push notification received
  if (notificationId) {
    logToDatabase(
      'INFO',
      'ServiceWorker',
      '[Push] Notification push received',
      {
        notificationId: notificationId,
        bucketId: bucketId,
        hasAttachments: payload.attachments && payload.attachments.length > 0
      }
    ).catch(e => console.error('[Service Worker] Failed to log push received:', e));
  }

  // Build notification options with media attachments and actions
  const options = {
    body: body,
    // icon: '/logo192.png',
    icon: payload.bucketIcon ?? '/logo192.png',
    image: payload.image ?? payload.bucketIcon,
    badge: '/logo72.png',
    data: {
      url: url,
      notificationId: notificationId,
      bucketId: bucketId,
      tapAction: payload.tapAction,
      actions: actions
    },
    actions: actions.map(action => ({
      action: `${action.type}___${action.value}`,
      title: `${action.icon ? action.icon + ' ' : ''}${action.title || action.value}`,
    })),
    tag: `notification-${notificationId}`, // Prevent duplicate notifications
    requireInteraction: payload.deliveryType === 'CRITICAL', // Critical notifications stay visible
    silent: payload.deliveryType === 'SILENT' // Silent notifications don't make sound
  };

  console.log('[Service Worker] Showing notification:', title, options);

  // Store notification data for IndexedDB
  const pendingNotificationData = {
    notificationId: notificationId,
    title: title,
    body: body,
    subtitle: payload.subtitle,
    bucketId: bucketId,
    bucketName: payload.bucketName,
    bucketIconUrl: payload.bucketIcon,
    tapAction: payload.tapAction,
    actions: actions,
    attachmentData: payload.attachments || [],
    deliveryType: payload.deliveryType || 'PUSH',
    timestamp: Date.now()
  };

  // Show notification, store as pending, notify the app, and prefetch media
  event.waitUntil(
    (async () => {
      try {
        // Show notification
        await self.registration.showNotification(title, options);

        // Save notification to IndexedDB
        try {
          await storePendingNotification(pendingNotificationData);
        } catch (error) {
          console.error('[Service Worker] Failed to save notification to IndexedDB:', error);
        }

        // Prefetch media attachment if available
        try {
          const attachmentData = payload.attachments || [];
          const attachmentToPrefetch = selectFirstAttachmentForPrefetch(attachmentData);

          if (attachmentToPrefetch) {
            console.log(`[Service Worker] Starting prefetch for notification ${notificationId}:`, attachmentToPrefetch.mediaType);
            await prefetchMediaAttachment(attachmentToPrefetch, notificationId);
            console.log(`[Service Worker] Prefetch completed for notification ${notificationId}`);
          } else {
            console.log(`[Service Worker] No suitable attachment found for prefetch in notification ${notificationId}`);
          }
        } catch (error) {
          console.error('[Service Worker] Failed to prefetch media attachment:', error);
          // Don't fail the entire notification process if prefetch fails
        }

        // Notify the app about the new notification
        try {
          const clients = await self.clients.matchAll({ includeUncontrolled: true });
          clients.forEach(client => {
            client.postMessage({
              type: 'notification-received',
              notificationId: notificationId,
              title: title,
              body: body,
              bucketId: bucketId,
              bucketName: payload.bucketName,
              bucketIconUrl: payload.bucketIcon,
              tapAction: payload.tapAction,
              actions: actions,
              timestamp: Date.now()
            });
          });
        } catch (error) {
          console.error('[Service Worker] Failed to notify clients:', error);
        }
      } catch (error) {
        console.error('[Service Worker] Error in push event handler:', error);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event);

  event.notification.close();

  const notificationData = event.notification.data;
  const action = event.action;
  const url = notificationData?.url || '/';
  const notificationId = notificationData?.notificationId;
  const bucketId = notificationData?.bucketId;

  // Handle action buttons (if any were clicked)
  if (action && action !== 'default') {
    console.log('[Service Worker] Action clicked:', action);

    const [actionType, actionValue] = action.split('___');

    console.log('[Service Worker] Parsed action:', actionType, actionValue);

    // Use common handler for action buttons
    handleNotificationAction(actionType, actionValue, notificationData, event);
    return;
  }

  // Handle default notification click (tap on notification body)
  // Execute the tapAction if present, otherwise use default URL navigation
  const tapAction = notificationData?.tapAction;

  if (tapAction) {
    console.log('[Service Worker] Executing tapAction:', tapAction);

    // Use common handler for tapAction
    handleNotificationAction(tapAction.type, tapAction.value, notificationData, event);
  } else {
    // No tapAction, use default URL navigation
    event.waitUntil(
      (async () => {
        try {
          const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

          if (clientList.length > 0) {
            const focusedClient = clientList.find(client => client.focused) || clientList[0];
            focusedClient.postMessage({
              type: 'notification-click',
              url: url,
              notificationId: notificationId,
              bucketId: bucketId,
              data: notificationData
            });
            await focusedClient.focus();
          } else {
            if (self.clients.openWindow) {
              await self.clients.openWindow(url);
            }
          }
        } catch (error) {
          console.error('[Service Worker] Error in default notification click:', error);
        }
      })()
    );
  }
});

// Helper function to get stored data from IndexedDB
async function getStoredData(key) {
  return withIndexedDB((store, resolve, reject) => {
    const getRequest = store.get(key);
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        try {
          resolve(JSON.parse(getRequest.result));
        } catch (e) {
          resolve(getRequest.result);
        }
      } else {
        resolve(null);
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Get API endpoint and auth token for making authenticated requests
async function getApiCredentials() {
  try {
    const apiEndpoint = await getStoredData('api_endpoint');
    const authToken = await getStoredData('access_token');

    if (!apiEndpoint || !authToken) {
      console.warn('[Service Worker] Missing API credentials');
      return null;
    }

    return { apiEndpoint, authToken };
  } catch (error) {
    console.error('[Service Worker] Failed to get API credentials:', error);
    return null;
  }
}

// Execute API calls with authentication
async function executeApiCall(endpoint, method = 'GET', body = null) {
  const credentials = await getApiCredentials();
  if (!credentials) {
    throw new Error('No API credentials available');
  }

  const url = `${credentials.apiEndpoint}/api/v1${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${credentials.authToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log('[Service Worker] Making API call:', url, options);

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response;
}

// Log to IndexedDB app_log table
async function logToDatabase(level, tag, message, metadata = null) {
  try {
    const now = Date.now();
    const logEntry = {
      id: `${now}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
      level: level.toUpperCase(),
      tag: tag,
      message: message,
      meta_json: metadata ? JSON.stringify(metadata) : null,
      timestamp: now
    };
    
    await withIndexedDB((store, resolve, reject) => {
      const addRequest = store.add(logEntry);
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    }, 'readwrite', 'app_log');
  } catch (error) {
    // Silent fail to not break SW if logging fails
    console.error('[Service Worker] Failed to log to database:', error);
  }
}

// Common function to get pending notifications from IndexedDB
async function getPendingNotifications() {
  try {
    const result = await getStoredData('pending_notifications');
    return result || [];
  } catch (e) {
    console.error('[Service Worker] Failed to get pending notifications:', e);
    return [];
  }
}

// Common function to save pending notifications to IndexedDB
async function savePendingNotifications(pendingNotifications) {
  return withIndexedDB((store, resolve, reject) => {
    const putRequest = store.put(JSON.stringify(pendingNotifications), 'pending_notifications');
    putRequest.onsuccess = () => resolve();
    putRequest.onerror = () => reject(putRequest.error);
  }, 'readwrite');
}

// Remove pending notification for a specific notification ID
async function removePendingNotification(notificationId) {
  try {
    const pendingNotifications = await getPendingNotifications();

    // Filter out the notification to remove
    const filteredNotifications = pendingNotifications.filter(
      notification => notification.notificationId !== notificationId
    );

    if (filteredNotifications.length === pendingNotifications.length) {
      console.log('[Service Worker] No pending notification found for ID:', notificationId);
      return;
    }

    console.log('[Service Worker] Removing pending notification:', notificationId);
    await savePendingNotifications(filteredNotifications);
    console.log('[Service Worker] ✅ Pending notification removed:', notificationId);
  } catch (error) {
    console.error('[Service Worker] Failed to remove pending notification:', error);
    throw error;
  }
}

// --- GESTIONE DEL CICLO DI VITA DEL SERVICE WORKER (Best Practice) ---

// Forza il nuovo service worker ad attivarsi subito
self.addEventListener('install', () => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

// Assicura che il service worker prenda il controllo della pagina subito
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'PING') {
    // Respond to ping messages
    event.ports && event.ports[0] && event.ports[0].postMessage('PONG');
  }
});