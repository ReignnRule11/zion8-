import { describe, expect, it } from 'vitest';
import {
  chunkText,
  contentHashOf,
  decodeText,
  estimateTokens,
  isTextReadable,
  normalizeText,
} from './ai.utils';

const sentence = (index: number) =>
  `On the ${index}th day the congregation gathered for prayer and the reading of the word.`;

describe('isTextReadable', () => {
  it('accepts formats whose bytes already are text', () => {
    expect(isTextReadable('text/plain')).toBe(true);
    expect(isTextReadable('text/markdown')).toBe(true);
    expect(isTextReadable('application/json')).toBe(true);
    expect(isTextReadable(null, 'notes.md')).toBe(true);
    expect(isTextReadable(null, 'roster.csv')).toBe(true);
  });

  it('refuses formats that need an external extractor', () => {
    expect(isTextReadable('application/pdf')).toBe(false);
    expect(isTextReadable('image/jpeg', 'scan.jpg')).toBe(false);
    expect(isTextReadable('audio/mpeg', 'sermon.mp3')).toBe(false);
    expect(isTextReadable(null, 'minutes.docx')).toBe(false);
  });
});

describe('decodeText', () => {
  it('strips a byte order mark and control characters', () => {
    const decoded = decodeText(Buffer.from('\uFEFFHello\u0000 there\u0007', 'utf8'));
    expect(decoded.startsWith('\uFEFF')).toBe(false);
    expect(decoded).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/);
    expect(normalizeText(decoded)).toBe('Hello there');
  });
});

describe('normalizeText', () => {
  it('collapses runs of blank lines and trailing spaces', () => {
    const input = 'a   b\r\n\r\n\r\n\r\nc  \n';
    expect(normalizeText(input)).toBe('a b\n\nc');
  });
});

describe('estimateTokens', () => {
  it('never returns zero for non-empty text', () => {
    expect(estimateTokens('hi')).toBeGreaterThan(0);
  });
});

describe('chunkText', () => {
  it('returns nothing for empty content', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n  ')).toEqual([]);
  });

  it('keeps a short passage as one chunk that can be quoted exactly', () => {
    const text = 'The baptism service is on the first Sunday of March.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe(text);
    expect(chunks[0]!.ordinal).toBe(0);
    expect(chunks[0]!.charStart).toBe(0);
    expect(chunks[0]!.charEnd).toBe(text.length);
  });

  it('splits a long passage into ordered chunks within the maximum size', () => {
    const text = Array.from({ length: 60 }, (_, index) => sentence(index)).join(' ');
    const chunks = chunkText(text, { targetChars: 300, maxChars: 400, overlapChars: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, index) => {
      expect(chunk.ordinal).toBe(index);
      expect(chunk.content.length).toBeLessThanOrEqual(400);
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });

  it('keeps every chunk a verbatim slice of the normalised text', () => {
    const text = Array.from({ length: 40 }, (_, index) => sentence(index)).join('\n\n');
    const normalized = normalizeText(text);
    const chunks = chunkText(text, { targetChars: 250, maxChars: 350, overlapChars: 50 });

    for (const chunk of chunks) {
      expect(normalized.slice(chunk.charStart, chunk.charEnd).trim()).toBe(chunk.content);
      expect(chunk.contentHash).toBe(contentHashOf(chunk.content));
      expect(chunk.tokenCount).toBe(estimateTokens(chunk.content));
    }
  });

  it('does not split mid-word when a single segment exceeds the maximum', () => {
    const longWordRun = Array.from({ length: 400 }, () => 'shepherd').join(' ');
    const chunks = chunkText(longWordRun, { targetChars: 200, maxChars: 250, overlapChars: 0 });
    for (const chunk of chunks) {
      expect(chunk.content.startsWith('shepherd')).toBe(true);
      expect(chunk.content.endsWith('shepherd')).toBe(true);
    }
  });

  it('is deterministic', () => {
    const text = Array.from({ length: 30 }, (_, index) => sentence(index)).join(' ');
    expect(chunkText(text)).toEqual(chunkText(text));
  });

  it('covers the text without losing trailing content', () => {
    const text = Array.from({ length: 25 }, (_, index) => sentence(index)).join(' ');
    const normalized = normalizeText(text);
    const chunks = chunkText(text, { targetChars: 400, maxChars: 500, overlapChars: 60 });
    expect(chunks[chunks.length - 1]!.charEnd).toBe(normalized.length);
  });
});
