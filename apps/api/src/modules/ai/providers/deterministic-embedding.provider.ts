import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult,
} from '../ports/embedding.provider';

/**
 * A deterministic, dependency-free embedding provider.
 *
 * Text is projected into a fixed-width vector by hashing its tokens and token
 * bigrams into buckets with a signed weight, then L2-normalising. Two passages
 * that share vocabulary land close together under cosine similarity, which is
 * enough for retrieval to be useful and, more importantly, for the whole
 * pipeline to be reproducible: the same corpus always produces the same vectors
 * and therefore the same search results.
 *
 * It is deliberately not a semantic model. It is the default so that search and
 * grounded answers work with no provider configured; a workspace that wants
 * semantic recall points the embedding provider at its own endpoint.
 */
@Injectable()
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'DETERMINISTIC' as const;
  readonly model: string;
  readonly dimensions: number;

  constructor(config: AppConfigService) {
    this.dimensions = config.ai.embedding.dimensions;
    this.model = config.ai.embedding.model || `deterministic-hash-v1:${this.dimensions}`;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      vectors: request.inputs.map((input) => this.project(input)),
      model: this.model,
      provider: 'DETERMINISTIC',
      dimensions: this.dimensions,
    };
  }

  /** Exposed for tests so vectorisation can be asserted without the async port. */
  project(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = tokenize(text);

    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    for (let i = 0; i + 1 < tokens.length; i += 1) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }

    for (const [term, count] of counts) {
      const hash = fnv1a(term);
      const index = hash % this.dimensions;
      // Sublinear term frequency: a word repeated twenty times should not
      // dominate a vector the way its raw count would.
      const weight = (1 + Math.log(count)) * (hash & 0x8000 ? 1 : -1);
      vector[index] = (vector[index] ?? 0) + weight;
    }

    return l2Normalize(vector);
  }
}

const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(WORD_PATTERN) ?? [];
}

/** FNV-1a, 32-bit. Chosen for being short, stable and dependency-free. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function l2Normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const value of vector) sumSquares += value * value;
  if (sumSquares === 0) return vector;
  const norm = Math.sqrt(sumSquares);
  return vector.map((value) => value / norm);
}
