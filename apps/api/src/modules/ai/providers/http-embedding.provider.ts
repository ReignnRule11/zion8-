import { Injectable, Optional } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { DomainError } from '../../../common/errors/domain-error';
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult,
} from '../ports/embedding.provider';

interface EmbeddingsResponse {
  data?: Array<{ embedding?: number[] }>;
}

/**
 * Optional provider that calls an OpenAI-compatible `/embeddings` endpoint.
 *
 * The endpoint, key and dimensions come from the workspace's own configuration;
 * the platform never injects its own credentials into a tenant's data path. The
 * module only wires this class when an embedding base URL is configured, so it is
 * never reached otherwise.
 */
@Injectable()
export class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    @Optional() private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.dimensions = config.ai.embedding.dimensions;
    this.model = config.ai.embedding.model || `http-embedding:${this.dimensions}`;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const { baseUrl, apiKey } = this.config.ai.embedding;
    if (!baseUrl) {
      throw new DomainError(
        'AI_EMBEDDING_MODEL_UNAVAILABLE',
        'No embedding provider is configured for this workspace',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.ai.queryTimeoutMs);

    try {
      const response = await this.fetchImpl(`${baseUrl.replace(/\/+$/, '')}/embeddings`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.ai.embedding.model || undefined,
          input: request.inputs,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Provider responded with ${response.status}`);
      }

      const payload = (await response.json()) as EmbeddingsResponse;
      const vectors = (payload.data ?? []).map((item) => item.embedding ?? []);
      if (vectors.length !== request.inputs.length) {
        throw new Error('Provider returned a different number of vectors than inputs');
      }
      for (const vector of vectors) {
        if (vector.length !== this.dimensions) {
          throw new Error(
            `Provider returned ${vector.length}-dimensional vectors, expected ${this.dimensions}`,
          );
        }
      }

      return {
        vectors,
        model: this.model,
        provider: 'LLM',
        dimensions: this.dimensions,
      };
    } catch (error) {
      this.logger.warn(
        `Embedding request failed: ${error instanceof Error ? error.message : String(error)}`,
        'HttpEmbeddingProvider',
      );
      throw new DomainError(
        'AI_EMBEDDING_MODEL_UNAVAILABLE',
        'The embedding provider could not be reached right now',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
