import { Injectable, Optional } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { DomainError } from '../../../common/errors/domain-error';
import type { ChatClaim, ChatDraft, ChatProvider, ChatRequest } from '../ports/chat.provider';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

const SYSTEM_SUFFIX =
  'Answer only from the numbered evidence. Every claim must cite the id of the evidence it came ' +
  'from. If the evidence does not answer the question, set abstained to true and claims to an ' +
  'empty array. Respond as JSON: {"abstained": boolean, "content": string, ' +
  '"claims": [{"text": string, "citationIds": string[]}]}.';

/**
 * Optional provider that calls an OpenAI-compatible chat completions endpoint.
 *
 * Evidence is rendered as a numbered list and the model is required to attribute
 * each claim to a number. Any citation id the model invents is discarded here,
 * and the service verifies the surviving claims again against its own retrieved
 * set, so a hallucinated reference can never reach a client.
 *
 * The endpoint and key come from the workspace's own configuration. The module
 * only wires this class when a chat base URL is configured.
 */
@Injectable()
export class HttpChatProvider implements ChatProvider {
  readonly model: string | null;

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    @Optional() private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.model = config.ai.chat.model || null;
  }

  async complete(request: ChatRequest): Promise<ChatDraft> {
    const { baseUrl, apiKey, model } = this.config.ai.chat;
    if (!baseUrl) {
      throw new DomainError(
        'AI_ANSWER_UNAVAILABLE',
        'No answer provider is configured for this workspace',
      );
    }

    const allowed = new Set(request.passages.map((passage) => passage.citationId));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.ai.queryTimeoutMs);

    try {
      const response = await this.fetchImpl(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `${request.system}\n\n${SYSTEM_SUFFIX}` },
            ...request.history.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            { role: 'user', content: renderEvidence(request) },
          ],
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Provider responded with ${response.status}`);
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const raw = payload.choices?.[0]?.message?.content?.trim() ?? '';
      if (!raw) throw new Error('Provider returned an empty answer');

      return normalize(parseDraft(raw), allowed, model || 'gpt-4o-mini');
    } catch (error) {
      this.logger.warn(
        `Chat completion failed: ${error instanceof Error ? error.message : String(error)}`,
        'HttpChatProvider',
      );
      throw new DomainError(
        'AI_ANSWER_UNAVAILABLE',
        'The answer provider could not generate an answer right now',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function renderEvidence(request: ChatRequest): string {
  const evidence = request.passages
    .map((passage) => `[${passage.citationId}]\n${passage.content}`)
    .join('\n\n');
  return `Question: ${request.question}\n\nEvidence:\n${evidence || '(none)'}`;
}

function parseDraft(raw: string): Partial<ChatDraft> & { claims?: unknown } {
  const json = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(json) as Partial<ChatDraft> & { claims?: unknown };
  } catch {
    return { content: raw, abstained: false, claims: [] };
  }
}

function normalize(
  parsed: Partial<ChatDraft> & { claims?: unknown },
  allowed: Set<string>,
  model: string,
): ChatDraft {
  const rawClaims = Array.isArray(parsed.claims) ? parsed.claims : [];
  const claims: ChatClaim[] = [];
  for (const entry of rawClaims) {
    if (typeof entry !== 'object' || entry === null) continue;
    const candidate = entry as { text?: unknown; citationIds?: unknown };
    const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
    if (!text) continue;
    const citationIds = Array.isArray(candidate.citationIds)
      ? candidate.citationIds.filter(
          (id): id is string => typeof id === 'string' && allowed.has(id),
        )
      : [];
    if (citationIds.length === 0) continue;
    claims.push({ text, citationIds });
  }

  const abstained = parsed.abstained === true || claims.length === 0;
  return {
    content: abstained ? '' : typeof parsed.content === 'string' ? parsed.content : '',
    claims: abstained ? [] : claims,
    abstained,
    model,
    provider: 'LLM',
  };
}
