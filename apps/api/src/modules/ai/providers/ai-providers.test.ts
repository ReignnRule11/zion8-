import { describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../../common/config/app-config.service';
import type { ChatRequest } from '../ports/chat.provider';
import { DeterministicEmbeddingProvider } from './deterministic-embedding.provider';
import { ExtractiveChatProvider } from './extractive-chat.provider';

function embeddingConfig(dimensions = 128, model = ''): AppConfigService {
  return { ai: { embedding: { dimensions, model } } } as unknown as AppConfigService;
}

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  for (let i = 0; i < left.length; i += 1) dot += (left[i] ?? 0) * (right[i] ?? 0);
  return dot;
}

describe('DeterministicEmbeddingProvider', () => {
  it('produces normalised vectors of the configured width', async () => {
    const provider = new DeterministicEmbeddingProvider(embeddingConfig(256));
    const result = await provider.embed({ inputs: ['grace and peace'], purpose: 'document' });

    expect(result.vectors).toHaveLength(1);
    expect(result.vectors[0]).toHaveLength(256);
    expect(result.provider).toBe('DETERMINISTIC');
    expect(result.dimensions).toBe(256);

    const magnitude = Math.sqrt(cosine(result.vectors[0]!, result.vectors[0]!));
    expect(magnitude).toBeCloseTo(1, 10);
  });

  it('is deterministic: the same text always yields the same vector', async () => {
    const provider = new DeterministicEmbeddingProvider(embeddingConfig());
    const first = await provider.embed({ inputs: ['the good shepherd'], purpose: 'query' });
    const second = await provider.embed({ inputs: ['the good shepherd'], purpose: 'document' });
    expect(first.vectors[0]).toEqual(second.vectors[0]);
  });

  it('places texts that share vocabulary closer than unrelated ones', async () => {
    const provider = new DeterministicEmbeddingProvider(embeddingConfig(512));
    const result = await provider.embed({
      inputs: [
        'the shepherd leads the flock beside still waters',
        'the shepherd guides the flock beside quiet waters',
        'quarterly budget review and audit schedule',
      ],
      purpose: 'document',
    });

    const [biblical, paraphrase, budget] = result.vectors as [number[], number[], number[]];
    expect(cosine(biblical, paraphrase)).toBeGreaterThan(cosine(biblical, budget));
  });

  it('returns a zero vector for text with no tokens', async () => {
    const provider = new DeterministicEmbeddingProvider(embeddingConfig(64));
    const result = await provider.embed({ inputs: ['   ...   '], purpose: 'document' });
    expect(result.vectors[0]?.every((value) => value === 0)).toBe(true);
  });
});

describe('ExtractiveChatProvider', () => {
  const provider = new ExtractiveChatProvider();

  const request = (question: string, passages: ChatRequest['passages']): ChatRequest => ({
    system: 'Answer from the evidence only.',
    question,
    passages,
    history: [],
    temperature: 0,
    maxTokens: 512,
  });

  it('answers only with cited sentences drawn from the evidence', async () => {
    const draft = await provider.complete(
      request('When is the baptism service?', [
        {
          citationId: 'c1',
          content: 'The baptism service is on the first Sunday of March.',
        },
        {
          citationId: 'c2',
          content: 'The choir rehearses on Thursday evenings.',
        },
      ]),
    );

    expect(draft.abstained).toBe(false);
    expect(draft.provider).toBe('DETERMINISTIC');
    expect(draft.claims.length).toBeGreaterThan(0);
    for (const claim of draft.claims) {
      expect(claim.citationIds).toEqual(['c1']);
      expect(draft.content).toContain(claim.text);
    }
  });

  it('abstains when no evidence matches the question', async () => {
    const draft = await provider.complete(
      request('What is the parking policy?', [
        { citationId: 'c1', content: 'The baptism service is on the first Sunday of March.' },
      ]),
    );

    expect(draft.abstained).toBe(true);
    expect(draft.claims).toEqual([]);
    expect(draft.content).toBe('');
  });

  it('abstains when there is no evidence at all', async () => {
    const draft = await provider.complete(request('anything at all', []));
    expect(draft.abstained).toBe(true);
  });

  it('is deterministic across calls', async () => {
    const passages = [
      { citationId: 'c1', content: 'Youth camp runs in July. Youth camp has limited places.' },
      { citationId: 'c2', content: 'The youth camp is at the lake.' },
    ];
    const first = await provider.complete(request('youth camp', passages));
    const second = await provider.complete(request('youth camp', passages));
    expect(first).toEqual(second);
  });
});
