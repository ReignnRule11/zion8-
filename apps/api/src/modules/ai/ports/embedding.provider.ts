import type { AiProviderKind } from '@zion8/contracts';

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export interface EmbeddingRequest {
  /** Texts to embed, in order. The response preserves that order. */
  inputs: string[];
  /**
   * `document` and `query` are embedded differently by several providers. The
   * distinction is part of the port so a provider can honour it; the
   * deterministic provider ignores it, because a symmetric projection is what
   * makes its similarity meaningful.
   */
  purpose: 'document' | 'query';
}

export interface EmbeddingResult {
  vectors: number[][];
  model: string;
  provider: AiProviderKind;
  dimensions: number;
}

/**
 * Port for turning text into vectors.
 *
 * The default implementation is a deterministic local projection, so the whole
 * retrieval pipeline works, is reproducible in tests, and needs no key. A
 * workspace can opt into an HTTP provider without any change to the indexing or
 * query code that depends on this interface.
 */
export interface EmbeddingProvider {
  /** Which runtime produced the vectors. Recorded in the model registry. */
  readonly provider: AiProviderKind;
  readonly model: string;
  readonly dimensions: number;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
