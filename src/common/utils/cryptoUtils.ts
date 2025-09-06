export const generateRSAKeyPair = async () => {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );

  const publicJwk = await crypto.subtle.exportKey('jwk', publicKey);
  const privateJPkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
  const privatePem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(privateJPkcs8).toString('base64')}\n-----END PRIVATE KEY-----`;

  return {
    publicKey: JSON.stringify(publicJwk),
    privateKey: JSON.stringify(privatePem),
  };
};

const ab2b64 = (buf: ArrayBuffer) =>
  Buffer.from(new Uint8Array(buf)).toString('base64');

const b642ab = (b64: string) => Uint8Array.from(Buffer.from(b64, 'base64'));

export const encryptWithPublicKey = async (
  text: string,
  publicKeyString: string,
): Promise<string> => {
  // Import RSA public key from JWK
  const publicJwk = JSON.parse(publicKeyString);
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );

  // 1) Generate random AES-GCM key (256-bit)
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );

  // 2) Encrypt plaintext with AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(text);
  const aesEncrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data,
  );

  // WebCrypto returns ciphertext||tag for AES-GCM, split tag (last 16 bytes)
  const encryptedBytes = new Uint8Array(aesEncrypted);
  const tagLengthBytes = 16; // 128-bit tag
  const ciphertextBytes = encryptedBytes.slice(
    0,
    encryptedBytes.length - tagLengthBytes,
  );
  const tagBytes = encryptedBytes.slice(encryptedBytes.length - tagLengthBytes);

  // 3) Export AES key and encrypt with RSA-OAEP
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey,
  );

  // 4) Build envelope { k, i, p, t } with base64 components
  const envelope = {
    k: ab2b64(encryptedKey),
    i: ab2b64(iv.buffer),
    p: ab2b64(ciphertextBytes.buffer),
    t: ab2b64(tagBytes.buffer),
  };

  // 5) Return base64(JSON(envelope))
  const json = JSON.stringify(envelope);
  return Buffer.from(json, 'utf8').toString('base64');
};

export const decryptWithPrivateKey = async (
  b64: string,
  privateKeyString: string,
): Promise<string> => {
  const privateJwk = JSON.parse(privateKeyString);
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );

  const ciphertext = b642ab(b64);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
};
