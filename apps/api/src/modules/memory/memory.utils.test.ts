import { describe, expect, it } from 'vitest';
import { checksumOf, detectContentType, memoryStorageKey } from './memory.utils';

const pad = (prefix: number[] | Buffer | string, size = 16): Buffer => {
  const bytes = Buffer.isBuffer(prefix)
    ? Buffer.from(prefix)
    : typeof prefix === 'string'
      ? Buffer.from(prefix, 'ascii')
      : Buffer.from(prefix);
  return Buffer.concat([bytes, Buffer.alloc(Math.max(size - bytes.length, 0), 0x00)]);
};

describe('detectContentType', () => {
  it('identifies an image from its magic bytes', () => {
    expect(detectContentType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      detectContentType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    expect(detectContentType(pad('GIF89a'))).toBe('image/gif');
  });

  it('identifies audio and video containers', () => {
    expect(detectContentType(pad('RIFF0000WAVE'))).toBe('audio/wav');
    expect(detectContentType(pad([0x1a, 0x45, 0xdf, 0xa3]))).toBe('video/webm');
    expect(detectContentType(pad('ID3'))).toBe('audio/mpeg');
    expect(detectContentType(pad('0000ftypisom'))).toBe('video/mp4');
    expect(detectContentType(pad('0000ftypM4A '))).toBe('audio/mp4');
  });

  it('identifies documents', () => {
    expect(detectContentType(pad('%PDF-1.7'))).toBe('application/pdf');
    expect(detectContentType(pad('{\\rtf1'))).toBe('application/rtf');
  });

  it('returns null when the signature is unknown rather than guessing', () => {
    expect(detectContentType(pad('PK\u0003\u0004'))).toBeNull();
    expect(detectContentType(pad([0x01, 0x02, 0x03]))).toBeNull();
    expect(detectContentType(Buffer.alloc(4))).toBeNull();
  });
});

describe('checksumOf', () => {
  it('is stable and differentiates content', () => {
    const a = Buffer.from('church archive');
    expect(checksumOf(a)).toBe(checksumOf(Buffer.from('church archive')));
    expect(checksumOf(a)).not.toBe(checksumOf(Buffer.from('church archive ')));
    expect(checksumOf(a)).toHaveLength(64);
  });
});

describe('memoryStorageKey', () => {
  it('builds a content-addressed, tenant-scoped key', () => {
    const sha = 'a'.repeat(64);
    expect(memoryStorageKey('tenant-1', sha)).toBe(`tenants/tenant-1/memory/aa/${sha}`);
  });
});
