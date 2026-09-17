import { describe, expect, it } from 'vitest';
import {
  chapterize,
  detectScriptures,
  detectSpeaker,
  extractInsight,
  mediaKindOf,
  slugify,
  suggestTags,
  uniqueSlug,
  xmlEscape,
} from './sermon.utils';

describe('slugify', () => {
  it('produces a contract-valid slug from a title', () => {
    expect(slugify('The Good Shepherd')).toBe('the-good-shepherd');
    expect(slugify('  Hope, Faith & Love  ')).toBe('hope-faith-love');
  });

  it('falls back when the title has no usable characters', () => {
    expect(slugify('!!!').startsWith('sermon-')).toBe(true);
  });
});

describe('uniqueSlug', () => {
  it('appends a numeric suffix when the base is taken', () => {
    expect(uniqueSlug('hope', new Set(['hope']))).toBe('hope-2');
    expect(uniqueSlug('hope', new Set(['hope', 'hope-2']))).toBe('hope-3');
  });
});

describe('mediaKindOf', () => {
  it('maps content types onto the sermon media kind', () => {
    expect(mediaKindOf('audio/mpeg')).toBe('AUDIO');
    expect(mediaKindOf('video/mp4')).toBe('VIDEO');
    expect(mediaKindOf('text/plain')).toBe('TEXT');
    expect(mediaKindOf('image/png')).toBe('NONE');
    expect(mediaKindOf(null)).toBe('NONE');
  });
});

describe('detectScriptures', () => {
  it('extracts canonical references and aliases', () => {
    const found = detectScriptures(
      'We begin in John 3:16 and then turn to 1 Cor 13:4-7. Psalm 23 is the close.',
    );
    expect(found.map((item) => item.reference)).toEqual([
      'John 3:16',
      '1 Corinthians 13:4-7',
      'Psalm 23',
    ]);
  });

  it('deduplicates identical references', () => {
    const found = detectScriptures('John 3:16 and again John 3:16.');
    expect(found).toHaveLength(1);
  });

  it('ignores words that look like books but are not', () => {
    expect(detectScriptures('On page 12 we paused.')).toEqual([]);
  });
});

describe('chapterize', () => {
  it('splits a long transcript into bounded chapters', () => {
    const paragraphs = Array.from({ length: 8 }, (_, index) =>
      `This is paragraph ${index + 1}. The church gathered to hear the word of God and to pray together.`,
    );
    const chapters = chapterize(paragraphs.join('\n\n'), 3_600_000);
    expect(chapters.length).toBeGreaterThanOrEqual(3);
    expect(chapters[0]?.startMs).toBe(0);
    expect(chapters.at(-1)?.endMs).toBe(3_600_000);
  });
});

describe('extractInsight', () => {
  it('builds a summary and caption from the opening sentences', () => {
    const insight = extractInsight(
      'Grace is a gift. Faith receives it. Love spends it on the neighbour.',
      'Grace',
    );
    expect(insight.summary).toContain('Grace is a gift');
    expect(insight.socialCaption.startsWith('Grace:')).toBe(true);
    expect(insight.keyPoints.length).toBeGreaterThan(0);
  });
});

describe('suggestTags and detectSpeaker', () => {
  it('suggests frequent content words not already tagged', () => {
    const tags = suggestTags('baptism baptism baptism grace grace fellowship', ['grace']);
    expect(tags).toContain('baptism');
    expect(tags).not.toContain('grace');
  });

  it('reads a self-introduction when present', () => {
    expect(detectSpeaker('My name is Ada Okonkwo and I greet you.', null)).toBe('Ada Okonkwo');
    expect(detectSpeaker('Welcome to church.', 'Pastor Joy')).toBe('Pastor Joy');
  });
});

describe('xmlEscape', () => {
  it('escapes characters that would break RSS', () => {
    expect(xmlEscape(`A & B <C> "D"`)).toBe('A &amp; B &lt;C&gt; &quot;D&quot;');
  });
});
