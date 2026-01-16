import * as jose from 'jose';

let privateKey: jose.KeyLike | null = null;
let publicKey: jose.KeyLike | null = null;
let jwk: jose.JWK | null = null;

const KEY_ID = 'dev-key-1';

export async function initializeKeys(): Promise<void> {
  if (privateKey && publicKey) {
    return;
  }

  const keyPair = await jose.generateKeyPair('RS256');
  privateKey = keyPair.privateKey;
  publicKey = keyPair.publicKey;

  jwk = await jose.exportJWK(publicKey);
  jwk.kid = KEY_ID;
  jwk.use = 'sig';
  jwk.alg = 'RS256';
}

export function getPrivateKey(): jose.KeyLike {
  if (!privateKey) {
    throw new Error('Keys not initialized. Call initializeKeys() first.');
  }
  return privateKey;
}

export function getPublicKey(): jose.KeyLike {
  if (!publicKey) {
    throw new Error('Keys not initialized. Call initializeKeys() first.');
  }
  return publicKey;
}

export function getJWKS(): { keys: jose.JWK[] } {
  if (!jwk) {
    throw new Error('Keys not initialized. Call initializeKeys() first.');
  }
  return { keys: [jwk] };
}

export function getKeyId(): string {
  return KEY_ID;
}
