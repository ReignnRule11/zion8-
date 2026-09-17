import type { AiProviderKind } from '@zion8/contracts';

export const CHAT_PROVIDER = Symbol('CHAT_PROVIDER');

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** One piece of evidence the provider is allowed to reason over. */
export interface ChatPassage {
  /** The server-side citation id this passage must be attributed to if used. */
  citationId: string;
  content: string;
}

export interface ChatRequest {
  /** Instructions describing the capability, tone and refusal rule. */
  system: string;
  question: string;
  /** Retrieved evidence only. The provider never sees rows the caller cannot read. */
  passages: ChatPassage[];
  /** Prior turns, oldest first, used only for conversational continuity. */
  history: ChatMessage[];
  temperature: number;
  maxTokens: number;
}

/** A single assertion, each of which must carry at least one citation id. */
export interface ChatClaim {
  text: string;
  citationIds: string[];
}

export interface ChatDraft {
  content: string;
  claims: ChatClaim[];
  /** The provider declined to answer from the given evidence. */
  abstained: boolean;
  model: string | null;
  provider: AiProviderKind;
}

/**
 * Port for producing a grounded answer from retrieved evidence.
 *
 * Evidence is an explicit input rather than text embedded in a prompt. That is
 * what lets the service verify every claim against a citation id it generated
 * itself, and refuse an answer whose claims do not resolve. The
 * provider is therefore a domain port, not a generic LLM gateway: it cannot see
 * anything the retriever did not hand it.
 *
 * The default implementation is extractive and runs locally, so grounded answers
 * are available with no key. An HTTP provider is opt-in.
 */
export interface ChatProvider {
  readonly model: string | null;
  complete(request: ChatRequest): Promise<ChatDraft>;
}
