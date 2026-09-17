import type { MemberAiSummaryFacts } from '@zion8/contracts';

export const SUMMARY_PROVIDER = Symbol('SUMMARY_PROVIDER');

export interface SummaryTimelineItem {
  type: string;
  title: string;
  occurredAt: string;
}

export interface SummaryContext {
  member: {
    id: string;
    fullName: string;
    status: string;
    joinedAt: string | null;
    tags: string[];
  };
  facts: MemberAiSummaryFacts;
  timeline: SummaryTimelineItem[];
  focus?: string;
}

export interface SummaryDraft {
  content: string;
  highlights: string[];
  model: string | null;
  provider: 'DETERMINISTIC' | 'LLM';
}

/**
 * Port for turning a member's recorded facts into a written summary. The domain
 * depends only on this interface, which keeps the summary reproducible in tests
 * and lets a workspace opt into an LLM without changing the service or the
 * persisted shape.
 */
export interface SummaryProvider {
  generate(context: SummaryContext): Promise<SummaryDraft>;
}
