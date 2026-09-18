import { createHash, randomBytes } from 'node:crypto';
import type {
  SermonChapter,
  SermonInsight,
  SermonJobSummary,
  SermonMedia,
  SermonNote,
  SermonResponse,
  SermonScripture,
  SermonSeriesResponse,
  SermonSeriesSummary,
  SermonShare,
  SermonSummary,
  SermonTranscript,
} from '@zion8/contracts';

const SLUG_MAX = 40;

/**
 * Canonical English Bible book names, including common abbreviations that
 * appear in spoken or typed references. Order is longest-first so "1 John"
 * is preferred over "John".
 */
export const SCRIPTURE_BOOKS: readonly { name: string; aliases: readonly string[] }[] = [
  { name: 'Genesis', aliases: ['gen', 'gn'] },
  { name: 'Exodus', aliases: ['exod', 'ex'] },
  { name: 'Leviticus', aliases: ['lev', 'lv'] },
  { name: 'Numbers', aliases: ['num', 'nm'] },
  { name: 'Deuteronomy', aliases: ['deut', 'dt'] },
  { name: 'Joshua', aliases: ['josh', 'jos'] },
  { name: 'Judges', aliases: ['judg', 'jdg'] },
  { name: 'Ruth', aliases: ['ru'] },
  { name: '1 Samuel', aliases: ['1 sam', '1sa', 'i samuel'] },
  { name: '2 Samuel', aliases: ['2 sam', '2sa', 'ii samuel'] },
  { name: '1 Kings', aliases: ['1 kgs', '1ki', 'i kings'] },
  { name: '2 Kings', aliases: ['2 kgs', '2ki', 'ii kings'] },
  { name: '1 Chronicles', aliases: ['1 chr', '1ch', 'i chronicles'] },
  { name: '2 Chronicles', aliases: ['2 chr', '2ch', 'ii chronicles'] },
  { name: 'Ezra', aliases: ['ezr'] },
  { name: 'Nehemiah', aliases: ['neh'] },
  { name: 'Esther', aliases: ['est'] },
  { name: 'Job', aliases: ['jb'] },
  { name: 'Psalm', aliases: ['psalms', 'ps', 'psa'] },
  { name: 'Proverbs', aliases: ['prov', 'prv'] },
  { name: 'Ecclesiastes', aliases: ['eccl', 'ecc'] },
  { name: 'Song of Solomon', aliases: ['song', 'sos', 'song of songs'] },
  { name: 'Isaiah', aliases: ['isa', 'is'] },
  { name: 'Jeremiah', aliases: ['jer'] },
  { name: 'Lamentations', aliases: ['lam'] },
  { name: 'Ezekiel', aliases: ['ezek', 'eze'] },
  { name: 'Daniel', aliases: ['dan', 'dn'] },
  { name: 'Hosea', aliases: ['hos'] },
  { name: 'Joel', aliases: ['jl'] },
  { name: 'Amos', aliases: ['am'] },
  { name: 'Obadiah', aliases: ['obad', 'ob'] },
  { name: 'Jonah', aliases: ['jon'] },
  { name: 'Micah', aliases: ['mic'] },
  { name: 'Nahum', aliases: ['nah'] },
  { name: 'Habakkuk', aliases: ['hab'] },
  { name: 'Zephaniah', aliases: ['zeph', 'zep'] },
  { name: 'Haggai', aliases: ['hag'] },
  { name: 'Zechariah', aliases: ['zech', 'zec'] },
  { name: 'Malachi', aliases: ['mal'] },
  { name: 'Matthew', aliases: ['matt', 'mt'] },
  { name: 'Mark', aliases: ['mk', 'mrk'] },
  { name: 'Luke', aliases: ['lk'] },
  { name: 'John', aliases: ['jn', 'joh'] },
  { name: 'Acts', aliases: ['act'] },
  { name: 'Romans', aliases: ['rom', 'ro'] },
  { name: '1 Corinthians', aliases: ['1 cor', '1co', 'i corinthians'] },
  { name: '2 Corinthians', aliases: ['2 cor', '2co', 'ii corinthians'] },
  { name: 'Galatians', aliases: ['gal'] },
  { name: 'Ephesians', aliases: ['eph'] },
  { name: 'Philippians', aliases: ['phil', 'php'] },
  { name: 'Colossians', aliases: ['col'] },
  { name: '1 Thessalonians', aliases: ['1 thess', '1th', 'i thessalonians'] },
  { name: '2 Thessalonians', aliases: ['2 thess', '2th', 'ii thessalonians'] },
  { name: '1 Timothy', aliases: ['1 tim', '1ti', 'i timothy'] },
  { name: '2 Timothy', aliases: ['2 tim', '2ti', 'ii timothy'] },
  { name: 'Titus', aliases: ['tit'] },
  { name: 'Philemon', aliases: ['phlm', 'phm'] },
  { name: 'Hebrews', aliases: ['heb'] },
  { name: 'James', aliases: ['jas', 'jm'] },
  { name: '1 Peter', aliases: ['1 pet', '1pe', 'i peter'] },
  { name: '2 Peter', aliases: ['2 pet', '2pe', 'ii peter'] },
  { name: '1 John', aliases: ['1 jn', '1jo', 'i john'] },
  { name: '2 John', aliases: ['2 jn', '2jo', 'ii john'] },
  { name: '3 John', aliases: ['3 jn', '3jo', 'iii john'] },
  { name: 'Jude', aliases: ['jud'] },
  { name: 'Revelation', aliases: ['rev', 'rv'] },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll(' ', '\\s+');
}

const BOOK_LOOKUP: Array<{ name: string; pattern: RegExp }> = SCRIPTURE_BOOKS.flatMap((book) =>
  [book.name, ...book.aliases]
    .sort((left, right) => right.length - left.length)
    .map((alias) => ({
      name: book.name,
      pattern: new RegExp(`^${escapeRegex(alias)}$`, 'i'),
    })),
);

const BOOK_ALTERNATION = [...SCRIPTURE_BOOKS]
  .flatMap((book) => [book.name, ...book.aliases])
  .sort((left, right) => right.length - left.length)
  .map(escapeRegex)
  .join('|');

const REFERENCE_PATTERN = new RegExp(
  `\\b(${BOOK_ALTERNATION})\\s+(\\d{1,3})(?::(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?)?\\b`,
  'gi',
);

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'we',
  'with',
  'you',
]);

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function pageArgs(query: { offset: number; limit: number }): { skip: number; take: number } {
  return { skip: query.offset, take: query.limit };
}

/**
 * Builds a URL slug from a title. The result always satisfies `slugSchema`:
 * lowercase letters, numbers, inner hyphens, 3–40 characters.
 */
export function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
  if (base.length >= 3) return base;
  return `sermon-${randomBytes(3).toString('hex')}`.slice(0, SLUG_MAX);
}

export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 24)}-${randomBytes(4).toString('hex')}`;
}

export function shareToken(): string {
  return randomBytes(24).toString('base64url');
}

export function contentHashOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function mediaKindOf(contentType: string | null | undefined): 'AUDIO' | 'VIDEO' | 'TEXT' | 'NONE' {
  if (!contentType) return 'NONE';
  if (contentType.startsWith('audio/')) return 'AUDIO';
  if (contentType.startsWith('video/')) return 'VIDEO';
  if (
    contentType === 'text/plain' ||
    contentType === 'text/markdown' ||
    contentType === 'application/pdf'
  ) {
    return 'TEXT';
  }
  return 'NONE';
}

export interface DetectedScripture {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  reference: string;
}

export function detectScriptures(text: string): DetectedScripture[] {
  const found: DetectedScripture[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    const rawBook = (match[1] ?? '').replace(/\s+/g, ' ').trim();
    const book = resolveBook(rawBook);
    if (!book) continue;
    const chapter = Number(match[2]);
    const verseStart = match[3] ? Number(match[3]) : 1;
    const verseEnd = match[4] ? Number(match[4]) : verseStart;
    if (!Number.isFinite(chapter) || chapter < 1) continue;
    if (verseEnd < verseStart) continue;
    const reference =
      match[3] === undefined
        ? `${book} ${chapter}`
        : verseStart === verseEnd
          ? `${book} ${chapter}:${verseStart}`
          : `${book} ${chapter}:${verseStart}-${verseEnd}`;
    if (seen.has(reference)) continue;
    seen.add(reference);
    found.push({ book, chapter, verseStart, verseEnd, reference });
  }
  return found.slice(0, 40);
}

function resolveBook(raw: string): string | null {
  const normalised = raw.replace(/\s+/g, ' ').trim();
  for (const entry of BOOK_LOOKUP) {
    if (entry.pattern.test(normalised)) return entry.name;
  }
  return null;
}

export interface DraftChapter {
  ordinal: number;
  title: string;
  summary: string;
  startMs: number | null;
  endMs: number | null;
}

/**
 * Splits a transcript into chapters along paragraph or sentence-run boundaries.
 * Timing is estimated from character offsets when a duration is known, so a
 * player can still jump even without a timed transcript.
 */
export function chapterize(text: string, durationMs: number | null): DraftChapter[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const units = paragraphs.length >= 3 ? paragraphs : splitSentences(text);
  if (units.length === 0) return [];

  const target = Math.min(8, Math.max(3, Math.ceil(units.length / 4)));
  const groupSize = Math.max(1, Math.ceil(units.length / target));
  const chapters: DraftChapter[] = [];
  let cursor = 0;
  const totalChars = units.reduce((sum, unit) => sum + unit.length, 0) || 1;

  for (let index = 0; index < units.length; index += groupSize) {
    const group = units.slice(index, index + groupSize);
    const content = group.join(' ');
    const startMs =
      durationMs && durationMs > 0 ? Math.round((cursor / totalChars) * durationMs) : null;
    cursor += group.reduce((sum, unit) => sum + unit.length, 0);
    const endMs =
      durationMs && durationMs > 0 ? Math.round((cursor / totalChars) * durationMs) : null;
    chapters.push({
      ordinal: chapters.length,
      title: titleFrom(content),
      summary: content.slice(0, 280).trim(),
      startMs,
      endMs,
    });
  }
  return chapters;
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?\n]+[.!?]?/g) ?? [])
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function titleFrom(text: string): string {
  const sentence = splitSentences(text)[0] ?? text;
  const clipped = sentence.slice(0, 72).trim();
  return clipped.length < sentence.length ? `${clipped.replace(/[,:;–—-]+$/, '')}…` : clipped;
}

export interface DraftInsight {
  summary: string;
  keyPoints: string[];
  socialCaption: string;
}

export function extractInsight(text: string, title: string): DraftInsight {
  const sentences = splitSentences(text);
  const summary = sentences.slice(0, 3).join(' ').trim() || title;
  const keyPoints = sentences
    .slice(0, 8)
    .filter((sentence) => sentence.length > 40)
    .slice(0, 5);
  const socialCaption = `${title}: ${sentences[0] ?? summary}`.slice(0, 240).trim();
  return {
    summary: summary.slice(0, 2000),
    keyPoints: keyPoints.length > 0 ? keyPoints : [summary.slice(0, 200)],
    socialCaption,
  };
}

export function suggestTags(text: string, existing: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []) {
    if (STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([word]) => word)
    .filter((word) => !existing.some((tag) => tag.toLowerCase() === word));
  return ranked.slice(0, 8);
}

export function detectSpeaker(text: string, fallback: string | null): string | null {
  const intro = /\b(?:i am|i['’]m|my name is)\s+/i.exec(text);
  if (intro) {
    const rest = text.slice(intro.index + intro[0].length);
    const name = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/.exec(rest);
    if (name?.[1]) return name[1];
  }
  return fallback;
}

export function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function rfc822(value: Date): string {
  return value.toUTCString();
}

type SeriesRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description?: string | null;
  visibility: SermonSeriesSummary['visibility'];
  startsOn: Date | null;
  endsOn: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string;
  _count?: { sermons: number };
};

export function toSeriesSummary(row: SeriesRow): SermonSeriesSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    visibility: row.visibility,
    startsOn: toDateOnly(row.startsOn),
    endsOn: toDateOnly(row.endsOn),
    sermonCount: row._count?.sermons ?? 0,
    archivedAt: toIso(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSeriesResponse(row: SeriesRow & { tenantId: string }): SermonSeriesResponse {
  return {
    ...toSeriesSummary(row),
    tenantId: row.tenantId,
    description: row.description ?? null,
  };
}

type JobRow = {
  id: string;
  sermonId: string;
  type: SermonJobSummary['type'];
  status: SermonJobSummary['status'];
  attempts: number;
  maxAttempts: number;
  provider: string | null;
  blockedReason: string | null;
  lastError: string | null;
  availableAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toJobSummary(row: JobRow): SermonJobSummary {
  return {
    id: row.id,
    sermonId: row.sermonId,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    provider: row.provider,
    blockedReason: row.blockedReason,
    lastError: row.lastError,
    availableAt: row.availableAt.toISOString(),
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type TagRow = { tag: string };

type SermonListRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  speakerName: string | null;
  preachedAt: Date | null;
  status: SermonSummary['status'];
  visibility: SermonSummary['visibility'];
  mediaKind: SermonSummary['mediaKind'];
  durationMs: number | null;
  transcriptStatus: SermonSummary['transcriptStatus'];
  summaryStatus: SermonSummary['summaryStatus'];
  createdAt: Date;
  updatedAt: Date;
  tags: TagRow[];
  series: { id: string; slug: string; title: string } | null;
  _count?: { scriptures: number; chapters: number };
};

export function toSermonSummary(row: SermonListRow): SermonSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    speakerName: row.speakerName,
    preachedAt: toIso(row.preachedAt),
    status: row.status,
    visibility: row.visibility,
    mediaKind: row.mediaKind,
    durationMs: row.durationMs,
    series: row.series,
    tags: row.tags.map((tag) => tag.tag),
    scriptureCount: row._count?.scriptures ?? 0,
    chapterCount: row._count?.chapters ?? 0,
    transcriptStatus: row.transcriptStatus,
    summaryStatus: row.summaryStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type SegmentRow = {
  id: string;
  ordinal: number;
  startMs: number | null;
  endMs: number | null;
  speakerLabel: string | null;
  text: string;
};

type TranscriptRow = {
  id: string;
  sermonId: string;
  version: number;
  language: string;
  status: SermonTranscript['status'];
  source: SermonTranscript['source'];
  text: string;
  isCurrent?: boolean;
  createdAt: Date;
  segments: SegmentRow[];
};

export function toTranscript(row: TranscriptRow): SermonTranscript {
  return {
    id: row.id,
    sermonId: row.sermonId,
    version: row.version,
    language: row.language,
    status: row.status,
    source: row.source,
    text: row.text,
    segments: [...row.segments]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((segment) => ({
        id: segment.id,
        ordinal: segment.ordinal,
        startMs: segment.startMs,
        endMs: segment.endMs,
        speakerLabel: segment.speakerLabel,
        text: segment.text,
      })),
    createdAt: row.createdAt.toISOString(),
  };
}

type ChapterRow = {
  id: string;
  ordinal: number;
  startMs: number | null;
  endMs: number | null;
  title: string;
  summary: string | null;
};

export function toChapter(row: ChapterRow): SermonChapter {
  return {
    id: row.id,
    ordinal: row.ordinal,
    startMs: row.startMs,
    endMs: row.endMs,
    title: row.title,
    summary: row.summary,
  };
}

type ScriptureRow = {
  id: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  reference: string;
  startMs: number | null;
};

export function toScripture(row: ScriptureRow): SermonScripture {
  return {
    id: row.id,
    book: row.book,
    chapter: row.chapter,
    verseStart: row.verseStart,
    verseEnd: row.verseEnd,
    reference: row.reference,
    startMs: row.startMs,
  };
}

type InsightRow = {
  summary: string | null;
  keyPoints: string[];
  socialCaption: string | null;
  provider: string | null;
};

export function toInsight(row: InsightRow | null): SermonInsight {
  return {
    summary: row?.summary ?? null,
    keyPoints: row?.keyPoints ?? [],
    socialCaption: row?.socialCaption ?? null,
    provider: row?.provider ?? null,
  };
}

export function toMedia(input: {
  kind: SermonMedia['kind'];
  artifactId: string | null;
  contentType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
  url: string | null;
}): SermonMedia {
  return input;
}

type DetailRow = SermonListRow & {
  tenantId: string;
  description: string | null;
  location: string | null;
  language: string;
  speakerMemberId: string | null;
  mediaArtifactId: string | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  chapters: ChapterRow[];
  scriptures: ScriptureRow[];
  insight: InsightRow | null;
  transcripts: TranscriptRow[];
  jobs: JobRow[];
};

export function toSermonResponse(
  row: DetailRow,
  media: SermonMedia,
): SermonResponse {
  const current =
    row.transcripts.find((transcript) => transcript.isCurrent) ??
    [...row.transcripts].sort((left, right) => right.version - left.version)[0] ??
    null;
  return {
    ...toSermonSummary(row),
    tenantId: row.tenantId,
    description: row.description,
    location: row.location,
    language: row.language,
    speakerMemberId: row.speakerMemberId,
    mediaArtifactId: row.mediaArtifactId,
    publishedAt: toIso(row.publishedAt),
    archivedAt: toIso(row.archivedAt),
    media,
    insight: toInsight(row.insight),
    chapters: [...row.chapters].sort((left, right) => left.ordinal - right.ordinal).map(toChapter),
    scriptures: row.scriptures.map(toScripture),
    transcript: current ? toTranscript(current) : null,
    jobs: [...row.jobs]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(toJobSummary),
  };
}

export function toNote(row: {
  id: string;
  sermonId: string;
  userId: string;
  body: string;
  timestampMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}): SermonNote {
  return {
    id: row.id,
    sermonId: row.sermonId,
    userId: row.userId,
    body: row.body,
    timestampMs: row.timestampMs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toShare(
  row: {
    id: string;
    sermonId: string;
    token: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  },
  url: string,
): SermonShare {
  return {
    id: row.id,
    sermonId: row.sermonId,
    token: row.token,
    url,
    expiresAt: toIso(row.expiresAt),
    revokedAt: toIso(row.revokedAt),
    createdAt: row.createdAt.toISOString(),
  };
}
