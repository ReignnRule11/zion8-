import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service';

const VERSION = 'v1';
const IV_BYTES = 12;
const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class SecretBoxService {
  private readonly key: Buffer;

  constructor(private readonly config: AppConfigService) {
    this.key = config.encryptionKey;
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(
      ':',
    );
  }

  decrypt(payload: string): string {
    const [version, ivPart, tagPart, ciphertextPart] = payload.split(':');
    if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
      throw new Error('Unsupported encrypted payload');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length || leftBuffer.length === 0) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }
}
