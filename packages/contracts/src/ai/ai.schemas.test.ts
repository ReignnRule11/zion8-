import { describe, expect, it } from 'vitest';
import {
  AiAbstentionReason,
  AiCapability,
  AiDocumentStatus,
  AiSensitivity,
  AiSourceType,
  DEFAULT_SEARCH_LIMIT,
  MAX_QUERY_LENGTH,
  MAX_SEARCH_LIMIT,
  aiCitationSchema,
  aiSearchRequestSchema,
  aiSearchResponseSchema,
} from './search.schemas';
import {
  aiAnswerResponseSchema,
  aiAskRequestSchema,
  aiFeedbackSchema,
  aiMessageSchema,
  aiStreamEventSchema,
} from './ask.schemas';
import {
  MIN_INSIGHT_COHORT,
  aiReindexRequestSchema,
  meetingSummaryRequestSchema,
  prayerInsightsResponseSchema,
  volunteerRecommendationSchema,
} from './insight.schemas';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

describe('ai search contracts', () => {
  it('applies retrieval defaults without requiring a caller to specify them', () => {
    const parsed = aiSearchRequestSchema.parse({ query: 'when is the baptism service' });
    expect(parsed.capability).toBe(AiCapability.KNOWLEDGE_SEARCH);
    expect(parsed.limit).toBe(DEFAULT_SEARCH_LIMIT);
    expect(parsed.filters).toEqual({});
  });

  it('rejects a query beyond the maximum length', () => {
    expect(
      aiSearchRequestSchema.safeParse({ query: 'x'.repeat(MAX_QUERY_LENGTH + 1) }).success,
    ).toBe(false);
    expect(aiSearchRequestSchema.safeParse({ query: 'x'.repeat(MAX_QUERY_LENGTH) }).success).toBe(
      true,
    );
  });

  it('clamps the result window to the declared maximum', () => {
    expect(
      aiSearchRequestSchema.safeParse({ query: 'x', limit: MAX_SEARCH_LIMIT + 1 }).success,
    ).toBe(false);
    expect(aiSearchRequestSchema.safeParse({ query: 'x', limit: MAX_SEARCH_LIMIT }).success).toBe(
      true,
    );
  });

  it('requires citations to point at real identifiers, never bare labels', () => {
    const valid = aiCitationSchema.safeParse({
      chunkId: id,
      documentId: other,
      sourceType: AiSourceType.MEMORY_ARTIFACT,
      sourceId: id,
      sourceVersionId: null,
      title: 'Baptism policy',
      snippet: 'The baptism service is on the first Sunday of March.',
      charStart: 0,
      charEnd: 48,
      page: 1,
      startMs: null,
      endMs: null,
    });
    expect(valid.success).toBe(true);
    expect(aiCitationSchema.safeParse({ chunkId: 'not-a-uuid', documentId: other }).success).toBe(
      false,
    );
  });

  it('reports abstention instead of an empty passage list when retrieval finds nothing', () => {
    const parsed = aiSearchResponseSchema.parse({
      query: 'unknown thing',
      capability: AiCapability.KNOWLEDGE_SEARCH,
      passages: [],
      abstained: true,
      candidateCount: 0,
      embeddingModel: null,
      tookMs: 4,
    });
    expect(parsed.abstained).toBe(true);
    expect(parsed.passages).toEqual([]);
  });

  it('exposes a stable enum for sensitivity and document status', () => {
    expect(AiSensitivity.RESTRICTED).toBe('RESTRICTED');
    expect(AiDocumentStatus.INDEXED).toBe('INDEXED');
    expect(AiAbstentionReason.NO_EVIDENCE).toBe('NO_EVIDENCE');
  });
});

describe('ai ask contracts', () => {
  it('defaults an ask to non-streaming with a bounded evidence window', () => {
    const parsed = aiAskRequestSchema.parse({ question: 'who leads worship' });
    expect(parsed.stream).toBe(false);
    expect(parsed.limit).toBe(8);
    expect(parsed.capability).toBe(AiCapability.KNOWLEDGE_SEARCH);
  });

  it('requires an explicit abstention reason when an answer carries no prose', () => {
    const parsed = aiAnswerResponseSchema.parse({
      messageId: id,
      conversationId: other,
      capability: AiCapability.DOCUMENT_QA,
      answer: null,
      abstained: true,
      abstentionReason: AiAbstentionReason.BELOW_SUPPORT_THRESHOLD,
      claims: [],
      passages: [],
      grounding: {
        totalClaims: 2,
        supportedClaims: 0,
        supportRatio: 0,
        droppedCitations: 3,
        threshold: 0.5,
      },
      provider: 'DETERMINISTIC',
      model: 'extractive-v1',
      promptVersion: null,
      embeddingModel: null,
      tookMs: 12,
    });
    expect(parsed.abstained).toBe(true);
    expect(parsed.grounding.supportRatio).toBe(0);
  });

  it('parses a streamed answer as a discriminated sequence of frames', () => {
    expect(aiStreamEventSchema.safeParse({ type: 'delta', text: 'The ' }).success).toBe(true);
    expect(aiStreamEventSchema.safeParse({ type: 'citations', passages: [] }).success).toBe(true);
    expect(
      aiStreamEventSchema.safeParse({
        type: 'error',
        code: 'AI_ANSWER_UNAVAILABLE',
        message: 'down',
      }).success,
    ).toBe(true);
    expect(aiStreamEventSchema.safeParse({ type: 'final' }).success).toBe(false);
  });

  it('validates a persisted message including its citations and abstention', () => {
    const parsed = aiMessageSchema.parse({
      id,
      conversationId: other,
      role: 'ASSISTANT',
      content: 'The baptism service is on the first Sunday of March.',
      abstained: false,
      abstentionReason: null,
      citations: [],
      provider: 'DETERMINISTIC',
      model: 'extractive-v1',
      promptVersion: null,
      createdAt: new Date().toISOString(),
    });
    expect(parsed.role).toBe('ASSISTANT');
  });

  it('accepts structured feedback used to build the evaluation set', () => {
    expect(
      aiFeedbackSchema.safeParse({ messageId: id, rating: 'WRONG_CITATION', comment: 'off by one' })
        .success,
    ).toBe(true);
    expect(aiFeedbackSchema.safeParse({ messageId: id, rating: 'LOVED_IT' }).success).toBe(false);
  });
});

describe('ai insight contracts', () => {
  it('withholds an aggregate below the minimum cohort', () => {
    expect(MIN_INSIGHT_COHORT).toBeGreaterThanOrEqual(3);
    const parsed = prayerInsightsResponseSchema.parse({
      periodStart: new Date().toISOString(),
      periodEnd: new Date().toISOString(),
      totalRequests: 3,
      distinctRequesters: 3,
      cohortSufficient: false,
      themes: [],
      notes: null,
      generatedAt: new Date().toISOString(),
    });
    expect(parsed.cohortSufficient).toBe(false);
  });

  it('requires a recommendation to carry at least one reason', () => {
    const base = {
      memberId: id,
      memberName: 'Grace Adeyemi',
      roleId: other,
      roleName: 'Welcome Team',
      score: 0.82,
      eligible: true,
      ineligibilityReasons: [],
    };
    expect(
      volunteerRecommendationSchema.safeParse({ ...base, reasons: ['Served 4 times this quarter'] })
        .success,
    ).toBe(true);
    expect(volunteerRecommendationSchema.safeParse({ ...base, reasons: [] }).success).toBe(true);
    expect(volunteerRecommendationSchema.safeParse({ ...base, reasons: [''] }).success).toBe(false);
  });

  it('requires a meeting summary to name at least one source document', () => {
    expect(meetingSummaryRequestSchema.safeParse({ sourceIds: [id] }).success).toBe(true);
    expect(meetingSummaryRequestSchema.safeParse({ sourceIds: [] }).success).toBe(false);
  });

  it('defaults reindexing to incremental (non-forced) work', () => {
    const parsed = aiReindexRequestSchema.parse({});
    expect(parsed.force).toBe(false);
  });
});
