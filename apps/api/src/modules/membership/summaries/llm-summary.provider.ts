import { Injectable, Optional } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { DomainError } from '../../../common/errors/domain-error';
import type { SummaryContext, SummaryDraft, SummaryProvider } from './summary.provider';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * Optional provider that calls an OpenAI-compatible chat completions endpoint.
 *
 * The endpoint and key come from the workspace's own configuration
 * (`USER_LLM_*`); the platform never injects its own credentials into a
 * tenant's data path. When the provider is not configured the module wires the
 * deterministic provider instead, so this class is never reached.
 */
@Injectable()
export class LlmSummaryProvider implements SummaryProvider {
  constructor(
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    @Optional() private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(context: SummaryContext): Promise<SummaryDraft> {
    const { baseUrl, apiKey, model, timeoutMs } = this.config.llmSummary;
    if (!baseUrl) {
      throw new DomainError(
        'SUMMARY_GENERATION_FAILED',
        'No summary provider is configured for this workspace',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You write short, factual pastoral summaries for a church member record. ' +
                'Use only the facts provided. Never speculate or add information that is not present. ' +
                'Respond as JSON: {"content": string, "highlights": string[]}.',
            },
            { role: 'user', content: buildPrompt(context) },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Provider responded with ${response.status}`);
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const raw = payload.choices?.[0]?.message?.content?.trim() ?? '';
      if (!raw) throw new Error('Provider returned an empty summary');

      const parsed = parseDraft(raw);
      return {
        content: parsed.content,
        highlights: parsed.highlights.slice(0, 8),
        model: model || 'gpt-4o-mini',
        provider: 'LLM',
      };
    } catch (error) {
      this.logger.warn(
        `LLM summary generation failed: ${error instanceof Error ? error.message : String(error)}`,
        'LlmSummaryProvider',
      );
      throw new DomainError(
        'SUMMARY_GENERATION_FAILED',
        'The summary provider could not generate a summary right now',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildPrompt(context: SummaryContext): string {
  return JSON.stringify(
    {
      member: context.member,
      facts: context.facts,
      recentTimeline: context.timeline.slice(0, 25),
      focus: context.focus ?? null,
    },
    null,
    2,
  );
}

function parseDraft(raw: string): { content: string; highlights: string[] } {
  const json = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(json) as { content?: unknown; highlights?: unknown };
    const content = typeof parsed.content === 'string' ? parsed.content : raw;
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.filter((item): item is string => typeof item === 'string')
      : [];
    return { content, highlights };
  } catch {
    return { content: raw, highlights: [] };
  }
}
