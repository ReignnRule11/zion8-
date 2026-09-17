import { createHash } from 'node:crypto';
import {
  AI_MAX_CHUNK_CHARS,
  AI_MIN_CHUNK_CHARS,
  AI_CHUNK_OVERLAP_CHARS,
  AI_TARGET_CHUNK_CHARS,
} from '@zion8/contracts';

export interface AiChunkDraft {
  ordinal: number;
  content: string;
  contentHash: string;
  tokenCount: number;
  charStart: number;
  charEnd: number;
}

export interface ChunkOptions {
  targetChars?: number;
  maxChars?: number;
  overlapChars?: number;
  minChars?: number;
}

/**
 * The content types the index can read without an external extractor.
 *
 * These are formats where the bytes already are the text. Everything else — a
 * scanned page, a photograph of a notice sheet, a recording — needs OCR or
 * speech-to-text, which is a capability a workspace configures. Those sources
 * are recorded as PARTIAL rather than indexed as empty, so the gap is visible
 * instead of looking like an empty document.
 */
const TEXT_CONTENT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/xml',
  'application/json',
  'application/xml',
  'application/x-ndjson',
  'application/rtf',
]);

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'tsv',
  'json',
  'jsonl',
  'ndjson',
  'xml',
  'log',
  'rtf',
  'yml',
  'yaml',
]);

export function isTextReadable(contentType: string | null, fileName?: string | null): boolean {
  if (contentType && TEXT_CONTENT_TYPES.has(contentType.toLowerCase())) return true;
  if (fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension && TEXT_EXTENSIONS.has(extension)) return true;
  }
  return false;
}

/**
 * Decode stored bytes as UTF-8 text.
 *
 * A UTF-8 byte-order mark is stripped and control characters other than tab,
 * newline and carriage return are removed, because they are noise that would
 * otherwise be stored in the index and quoted in a citation.
 */
export function decodeText(bytes: Buffer): string {
  const decoded = bytes.toString('utf8');
  return decoded
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/** ~4 characters per token. Used for budgeting and reporting, never for billing. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function contentHashOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

interface Segment {
  text: string;
  start: number;
  end: number;
}

/**
 * Split normalised text into chunks along sentence and paragraph boundaries.
 *
 * Chunking exists so that a citation can quote a passage that stands on its own
 * and so that an embedding represents one idea rather than a whole document. It
 * never splits mid-word: a segment larger than the maximum is hard-split at the
 * nearest whitespace. Consecutive chunks overlap by a small tail so that a fact
 * spanning a boundary is still retrieved by one of the two neighbours.
 */
export function chunkText(text: string, options: ChunkOptions = {}): AiChunkDraft[] {
  const target = options.targetChars ?? AI_TARGET_CHUNK_CHARS;
  const max = options.maxChars ?? AI_MAX_CHUNK_CHARS;
  const overlap = options.overlapChars ?? AI_CHUNK_OVERLAP_CHARS;
  const min = options.minChars ?? AI_MIN_CHUNK_CHARS;

  const normalized = normalizeText(text);
  if (normalized.length === 0) return [];

  const segments = splitSegments(normalized, max);
  const chunks: AiChunkDraft[] = [];

  let buffer: Segment[] = [];
  const flush = (): void => {
    if (buffer.length === 0) return;
    const start = buffer[0]!.start;
    const end = buffer[buffer.length - 1]!.end;
    const content = normalized.slice(start, end).trim();
    if (content.length === 0) {
      buffer = [];
      return;
    }

    if (content.length < min && chunks.length > 0) {
      // Too short to stand alone: fold it into the previous chunk rather than
      // dropping text the church actually recorded.
      const previous = chunks[chunks.length - 1]!;
      const merged = normalized.slice(previous.charStart, end).trim();
      chunks[chunks.length - 1] = toDraft(chunks.length - 1, merged, previous.charStart, end);
    } else {
      chunks.push(toDraft(chunks.length, content, start, end));
    }

    // Start the next chunk with the tail of this one for continuity.
    const overlapStart = Math.max(start, end - overlap);
    const tail = normalized.slice(overlapStart, end).trim();
    buffer =
      tail.length > 0 && end < normalized.length ? [{ text: tail, start: overlapStart, end }] : [];
  };

  for (const segment of segments) {
    const bufferedLength =
      buffer.length === 0 ? 0 : buffer[buffer.length - 1]!.end - buffer[0]!.start;
    if (bufferedLength > 0 && bufferedLength + segment.text.length > target) {
      flush();
    }
    buffer.push(segment);
    const length = buffer[buffer.length - 1]!.end - buffer[0]!.start;
    if (length >= target) {
      flush();
    }
  }
  flush();

  return chunks.map((chunk, index) => ({ ...chunk, ordinal: index }));
}

function splitSegments(text: string, maxChars: number): Segment[] {
  const segments: Segment[] = [];
  const boundary = /(?<=[.!?])\s+|\n{2,}/g;

  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(text)) !== null) {
    const end = match.index;
    pushSegment(segments, text, cursor, end, maxChars);
    cursor = end;
  }
  pushSegment(segments, text, cursor, text.length, maxChars);
  return segments.filter((segment) => segment.text.trim().length > 0);
}

function pushSegment(
  segments: Segment[],
  text: string,
  start: number,
  end: number,
  maxChars: number,
): void {
  let cursor = start;
  while (end - cursor > maxChars) {
    const window = text.slice(cursor, cursor + maxChars);
    const lastSpace = window.lastIndexOf(' ');
    const split = lastSpace > maxChars * 0.5 ? cursor + lastSpace + 1 : cursor + maxChars;
    segments.push({ text: text.slice(cursor, split), start: cursor, end: split });
    cursor = split;
  }
  if (end > cursor) {
    segments.push({ text: text.slice(cursor, end), start: cursor, end });
  }
}

function toDraft(
  ordinal: number,
  content: string,
  charStart: number,
  charEnd: number,
): AiChunkDraft {
  return {
    ordinal,
    content,
    contentHash: contentHashOf(content),
    tokenCount: estimateTokens(content),
    charStart,
    charEnd,
  };
}
