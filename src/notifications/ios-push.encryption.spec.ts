import { Test, TestingModule } from '@nestjs/testing';
import { IOSPushService } from './ios-push.service';
import { LocaleService } from '../common/services/locale.service';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { NotificationActionType } from './notifications.types';
import { generateRSAKeyPair } from '../common/utils/cryptoUtils';

// Mock apn module (same shape as in ios-push.service.spec.ts)
jest.mock(
  'apn',
  () => ({
    Provider: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
      shutdown: jest.fn(),
    })),
    Notification: jest.fn().mockImplementation(() => ({
      rawPayload: null,
      payload: null,
      priority: null,
      topic: null,
    })),
  }),
  { virtual: true },
);

describe('IOSPushService APN encryption compatibility', () => {
  let service: IOSPushService;
  let privateKeyPemJson: string;

  const mockLocaleService = {
    getLocale: jest.fn().mockReturnValue('en'),
    getTranslatedText: jest.fn().mockImplementation((locale: string, key: string) => {
      const translations: Record<string, string> = {
        'notifications.actions.delete': 'Delete',
        'notifications.actions.markAsRead': 'Mark as Read',
        'notifications.actions.openNotification': 'Open',
        'notifications.actions.snooze': 'Snooze',
        'notifications.actions.postpone': 'Postpone',
      };
      return translations[key] || key;
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IOSPushService,
        {
          provide: LocaleService,
          useValue: mockLocaleService,
        },
        {
          provide: ServerSettingsService,
          useValue: {
            getSettingByType: jest.fn().mockResolvedValue({
              valueText: 'com.test.app',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<IOSPushService>(IOSPushService);

    // Generate a real RSA keypair compatible with cryptoUtils/encryptWithPublicKey
    const keyPair = await generateRSAKeyPair();
    // device.publicKey expects the JWK string returned here
    (global as any).__testApnPublicKey = keyPair.publicKey;
    privateKeyPemJson = keyPair.privateKey;
  });

  it('should produce an encrypted APN payload decryptable with iOS envelope semantics', async () => {
    const publicKey = (global as any).__testApnPublicKey as string;

    const mockNotification = {
      id: 'notification-1',
      message: {
        id: 'message-1',
        title: 'Test Message',
        body: 'Test Body',
        subtitle: 'Test Subtitle',
        bucketId: 'bucket-1',
        sound: 'default',
        deliveryType: 'NORMAL',
        actions: [
          {
            type: NotificationActionType.NAVIGATE,
            value: '/test',
            title: 'Navigate',
          },
        ],
        attachments: [
          {
            mediaType: 'IMAGE',
            url: 'https://example.com/image.jpg',
            name: 'image.jpg',
          },
        ],
        bucket: {
          id: 'bucket-1',
          name: 'Test Bucket',
          icon: 'https://example.com/bucket-icon.png',
          color: '#FF0000',
        },
      },
    };

    const mockUserSettings = {
      autoAddDeleteAction: true,
      autoAddMarkAsReadAction: true,
      autoAddOpenNotificationAction: false,
      defaultSnoozes: [15, 30],
      defaultPostpones: [60],
    };

    const mockDevice = {
      id: 'device-1',
      deviceToken: 'device-token-123',
      publicKey,
      badgeCount: 5,
    } as any;

    const result = await service.buildAPNsPayload(
      mockNotification as any,
      mockUserSettings as any,
      mockDevice,
    );

    expect(result.payload.e).toBeDefined();
    const encryptedBlob = result.payload.e as string;

    const decryptedJson = await decryptApnEnvelope(encryptedBlob, privateKeyPemJson);
    const sensitive = JSON.parse(decryptedJson);

    // Core fields must round-trip correctly
    expect(sensitive.tit).toBe(mockNotification.message.title);
    expect(sensitive.bdy).toBe(mockNotification.message.body);
    expect(sensitive.stl).toBe(mockNotification.message.subtitle);

    // Attachments are encoded as ["IMAGE:url"]
    expect(sensitive.att).toEqual([
      'IMAGE:https://example.com/image.jpg',
    ]);

    // Tap action is encoded as abbreviated object under tp
    expect(sensitive.tp).toBeDefined();
    expect(typeof sensitive.tp.t).toBe('number');
  });

  it('should remain decryptable when blob is base64url-encoded as in NSE', async () => {
    const publicKey = (global as any).__testApnPublicKey as string;

    const mockNotification = {
      id: 'notification-2',
      message: {
        id: 'message-2',
        title: 'UrlSafe Title',
        body: 'UrlSafe Body',
        subtitle: 'UrlSafe Subtitle',
        bucketId: 'bucket-2',
        sound: 'default',
        deliveryType: 'NORMAL',
        actions: [],
        attachments: [],
        bucket: null,
      },
    };

    const mockUserSettings = {
      autoAddDeleteAction: false,
      autoAddMarkAsReadAction: false,
      autoAddOpenNotificationAction: false,
      defaultSnoozes: [],
      defaultPostpones: [],
    };

    const mockDevice = {
      id: 'device-2',
      deviceToken: 'device-token-456',
      publicKey,
      badgeCount: 0,
    } as any;

    const result = await service.buildAPNsPayload(
      mockNotification as any,
      mockUserSettings as any,
      mockDevice,
    );

    expect(result.payload.e).toBeDefined();
    const encryptedBlobB64 = result.payload.e as string;

    // Simula l'encoding base64url usato dal NotificationService Swift
    const encryptedBlobB64Url = toBase64Url(encryptedBlobB64);

    const decryptedJson = await decryptApnEnvelopeFromBase64Url(
      encryptedBlobB64Url,
      privateKeyPemJson,
    );
    const sensitive = JSON.parse(decryptedJson);

    expect(sensitive.tit).toBe(mockNotification.message.title);
    expect(sensitive.bdy).toBe(mockNotification.message.body);
    expect(sensitive.stl).toBe(mockNotification.message.subtitle);
  });
});

async function decryptApnEnvelope(
  encryptedValue: string,
  privateKeyPemJson: string,
): Promise<string> {
  const webcrypto: Crypto | undefined = (global as any).crypto;
  if (!webcrypto || !webcrypto.subtle) {
    throw new Error('WebCrypto API not available in test environment');
  }

  // Decode base64 (backend encodes JSON(envelope) as base64 string)
  const envelopeBuffer = Buffer.from(encryptedValue, 'base64');
  const envelopeJson = envelopeBuffer.toString('utf8');
  const envelope = JSON.parse(envelopeJson) as {
    k: string; // encrypted AES key (base64)
    i: string; // iv (base64)
    p: string; // ciphertext (base64)
    t: string; // tag (base64)
  };

  const encryptedKey = Buffer.from(envelope.k, 'base64');
  const iv = Buffer.from(envelope.i, 'base64');
  const ciphertext = Buffer.from(envelope.p, 'base64');
  const tag = Buffer.from(envelope.t, 'base64');

  // Import RSA private key from PEM (JSON-wrapped string, like on iOS keychain)
  const pemString = JSON.parse(privateKeyPemJson) as string;
  const pkcs8Base64 = pemString
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const pkcs8 = Buffer.from(pkcs8Base64, 'base64');

  const rsaPrivateKey = await webcrypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );

  // Decrypt AES key with RSA-OAEP
  const rawAesKey = await webcrypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    rsaPrivateKey,
    encryptedKey,
  );

  const aesKey = await webcrypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  // WebCrypto AES-GCM expects ciphertext||tag
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const plaintextBuffer = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    aesKey,
    combined,
  );

  return new TextDecoder().decode(plaintextBuffer);
}

function toBase64Url(b64: string): string {
  return b64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function decryptApnEnvelopeFromBase64Url(
  encryptedValueUrl: string,
  privateKeyPemJson: string,
): Promise<string> {
  // Replica la normalizzazione base64url -> base64 che fa NotificationService.decryptValue
  let base64Value = encryptedValueUrl
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padLength = (4 - (base64Value.length % 4)) % 4;
  if (padLength) {
    base64Value = base64Value + '='.repeat(padLength);
  }

  return decryptApnEnvelope(base64Value, privateKeyPemJson);
}
