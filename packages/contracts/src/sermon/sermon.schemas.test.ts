import { describe, expect, it } from 'vitest';
import {
  ALLOWED_SERMON_MEDIA_TYPES,
  SermonGenerateKind,
  SermonStage,
  SermonStatus,
  SermonVisibility,
  sermonCreateSchema,
  sermonGenerateSchema,
  sermonListQuerySchema,
  sermonPublishSchema,
  sermonReprocessSchema,
  sermonSearchQuerySchema,
  sermonUpdateSchema,
} from './sermon.schemas';
import { sermonSeriesCreateSchema } from './series.schemas';
import { sermonNoteCreateSchema } from './note.schemas';
import { sermonShareCreateSchema } from './share.schemas';

const id = '11111111-1111-4111-8111-111111111111';

describe('sermon create contract', () => {
  it('accepts a metadata-only draft with defaults', () => {
    const parsed = sermonCreateSchema.parse({ title: 'The Good Shepherd' });
    expect(parsed.visibility).toBe(SermonVisibility.MEMBERS);
    expect(parsed.language).toBe('en');
    expect(parsed.tags).toEqual([]);
  });

  it('rejects an incomplete media upload', () => {
    expect(
      sermonCreateSchema.safeParse({ title: 'Hope', fileName: 'hope.mp3' }).success,
    ).toBe(false);
  });

  it('rejects attaching an artifact and uploading bytes together', () => {
    expect(
      sermonCreateSchema.safeParse({
        title: 'Hope',
        artifactId: id,
        fileName: 'hope.mp3',
        contentType: 'audio/mpeg',
        contentBase64: 'QQ==',
      }).success,
    ).toBe(false);
  });

  it('accepts a complete media upload', () => {
    const parsed = sermonCreateSchema.parse({
      title: 'Hope',
      fileName: 'hope.mp3',
      contentType: 'audio/mpeg',
      contentBase64: 'QQ==',
    });
    expect(parsed.fileName).toBe('hope.mp3');
  });
});

describe('sermon update and publish contracts', () => {
  it('allows clearing optional fields with null', () => {
    const parsed = sermonUpdateSchema.parse({
      subtitle: null,
      seriesId: null,
      preachedAt: null,
    });
    expect(parsed.subtitle).toBeNull();
    expect(parsed.seriesId).toBeNull();
  });

  it('defaults publish visibility to unspecified so the current value is kept', () => {
    const parsed = sermonPublishSchema.parse({});
    expect(parsed.visibility).toBeUndefined();
  });
});

describe('sermon query contracts', () => {
  it('applies list pagination defaults', () => {
    const parsed = sermonListQuerySchema.parse({});
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
  });

  it('requires a search query', () => {
    expect(sermonSearchQuerySchema.safeParse({}).success).toBe(false);
    expect(sermonSearchQuerySchema.parse({ q: 'grace' }).q).toBe('grace');
  });
});

describe('sermon pipeline contracts', () => {
  it('accepts a subset of stages for reprocess', () => {
    const parsed = sermonReprocessSchema.parse({
      stages: [SermonStage.SUMMARIZE, SermonStage.CHAPTERIZE],
    });
    expect(parsed.stages).toHaveLength(2);
  });

  it('requires a generate kind', () => {
    expect(sermonGenerateSchema.safeParse({}).success).toBe(false);
    expect(sermonGenerateSchema.parse({ kind: SermonGenerateKind.SOCIAL }).kind).toBe('SOCIAL');
  });

  it('restricts sermon media to audio, video and readable text', () => {
    expect(ALLOWED_SERMON_MEDIA_TYPES).toContain('audio/mpeg');
    expect(ALLOWED_SERMON_MEDIA_TYPES).toContain('video/mp4');
    expect(ALLOWED_SERMON_MEDIA_TYPES).toContain('text/plain');
    expect(ALLOWED_SERMON_MEDIA_TYPES).not.toContain('image/png');
  });

  it('exposes every sermon status a client may render', () => {
    expect(Object.values(SermonStatus)).toEqual([
      'DRAFT',
      'PROCESSING',
      'READY',
      'PUBLISHED',
      'ARCHIVED',
    ]);
  });
});

describe('series, notes and share contracts', () => {
  it('requires a series title', () => {
    expect(sermonSeriesCreateSchema.safeParse({}).success).toBe(false);
    expect(sermonSeriesCreateSchema.parse({ title: 'The Psalms' }).visibility).toBe('MEMBERS');
  });

  it('rejects an empty note', () => {
    expect(sermonNoteCreateSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(sermonNoteCreateSchema.parse({ body: 'Pray this week.', timestampMs: 12000 }).body).toBe(
      'Pray this week.',
    );
  });

  it('bounds share expiry', () => {
    expect(sermonShareCreateSchema.safeParse({ expiresInDays: 0 }).success).toBe(false);
    expect(sermonShareCreateSchema.parse({ expiresInDays: 30 }).expiresInDays).toBe(30);
  });
});
