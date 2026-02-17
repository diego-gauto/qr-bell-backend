import * as crypto from 'crypto';

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function signVisitorToken(callId: string, secret: string): string {
  const digest = crypto.createHmac('sha256', secret).update(callId, 'utf8').digest();
  return base64UrlEncode(digest);
}

export function verifyVisitorToken(callId: string, token: string, secret: string): boolean {
  const expected = signVisitorToken(callId, secret);
  return timingSafeEqual(expected, token);
}

