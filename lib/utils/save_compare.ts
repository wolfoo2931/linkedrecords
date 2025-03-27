import crypto from 'crypto';

// A direct === comparison may expose the application to timing attacks on HMAC checks
export default function safeCompare(str1: string, str2: string): boolean {
  try {
    return crypto.timingSafeEqual(new Uint8Array(Buffer.from(str1, 'utf-8')), new Uint8Array(Buffer.from(str2, 'utf-8')));
  } catch (ex: any) {
    if (ex?.code === 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH') {
      return false;
    }

    throw ex;
  }
}
