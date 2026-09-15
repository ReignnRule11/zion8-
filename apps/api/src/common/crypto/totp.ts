import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { base32Decode, base32Encode } from './base32';

const DEFAULT_PERIOD_SECONDS = 30;
const DEFAULT_DIGITS = 6;
const DEFAULT_SECRET_BYTES = 20;

export function generateTotpSecret(bytes = DEFAULT_SECRET_BYTES): string {
  return base32Encode(randomBytes(bytes));
}

export function totpCode(
  secretBase32: string,
  options: { timestamp?: number; period?: number; digits?: number } = {},
): string {
  const period = options.period ?? DEFAULT_PERIOD_SECONDS;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const counter = Math.floor((options.timestamp ?? Date.now()) / 1000 / period);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', base32Decode(secretBase32)).update(counterBuffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export function verifyTotp(
  secretBase32: string,
  code: string,
  options: { timestamp?: number; period?: number; digits?: number; window?: number } = {},
): boolean {
  const period = options.period ?? DEFAULT_PERIOD_SECONDS;
  const window = options.window ?? 1;
  const normalized = code.trim();
  if (!/^\d+$/u.test(normalized)) return false;

  const base = options.timestamp ?? Date.now();
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = totpCode(secretBase32, {
      timestamp: base + offset * period * 1000,
      period,
      digits: options.digits,
    });
    if (safeEqual(candidate, normalized)) return true;
  }
  return false;
}

export function totpAuthUri(input: {
  secret: string;
  accountName: string;
  issuer: string;
  digits?: number;
  period?: number;
}): string {
  const digits = input.digits ?? DEFAULT_DIGITS;
  const period = input.period ?? DEFAULT_PERIOD_SECONDS;
  const label = encodeURIComponent(`${input.issuer}:${input.accountName}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
