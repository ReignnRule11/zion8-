import { Injectable } from '@nestjs/common';
import type {
  ChatClaim,
  ChatDraft,
  ChatPassage,
  ChatProvider,
  ChatRequest,
} from '../ports/chat.provider';

const MAX_SENTENCES = 4;
const SENTENCE_PATTERN = /[^.!?\n]+[.!?]*/g;
const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'did',
  'do',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'how',
  'i',
  'in',
  'is',
  'it',
  'its',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'you',
  'your',
]);

/**
 * The default answer provider: an extractive, local, deterministic reader.
 *
 * It never writes new prose. It selects the sentences of the retrieved passages
 * that best overlap the question and returns each as a claim with the citation id
 * of the passage it came from. That makes it a faithful stand-in for a grounded
 * answer without a model: it can only ever say things the archive already says,
 * and every sentence it emits is already attributable to a source.
 *
 * When no sentence overlaps the question it abstains, rather than answering from
 * nothing. This is the same cite-or-refuse discipline the LLM path enforces.
 */
@Injectable()
export class ExtractiveChatProvider implements ChatProvider {
  readonly model = 'extractive-v1';

  async complete(request: ChatRequest): Promise<ChatDraft> {
    const questionTerms = contentTerms(request.question);
    if (questionTerms.size === 0) {
      return this.abstain();
    }

    const scored: Array<{ passage: ChatPassage; sentence: string; score: number }> = [];
    for (const passage of request.passages) {
      const sentences = passage.content.match(SENTENCE_PATTERN) ?? [];
      for (const raw of sentences) {
        const sentence = raw.trim();
        if (sentence.length === 0) continue;
        const score = overlapScore(questionTerms, sentence);
        if (score > 0) scored.push({ passage, sentence, score });
      }
    }

    if (scored.length === 0) {
      return this.abstain();
    }

    // Highest overlap first; ties broken by the order the evidence was given so
    // the same corpus and question always yield the same answer.
    const order = new Map<string, number>();
    request.passages.forEach((passage, index) => order.set(passage.citationId, index));
    scored.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (order.get(left.passage.citationId) ?? 0) - (order.get(right.passage.citationId) ?? 0);
    });

    const selected = scored.slice(0, MAX_SENTENCES).sort((left, right) => {
      const leftIndex = order.get(left.passage.citationId) ?? 0;
      const rightIndex = order.get(right.passage.citationId) ?? 0;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      const leftOffset = left.passage.content.indexOf(left.sentence);
      const rightOffset = right.passage.content.indexOf(right.sentence);
      return leftOffset - rightOffset;
    });

    const seen = new Set<string>();
    const claims: ChatClaim[] = [];
    for (const item of selected) {
      if (seen.has(item.sentence)) continue;
      seen.add(item.sentence);
      claims.push({ text: item.sentence, citationIds: [item.passage.citationId] });
    }

    if (claims.length === 0) return this.abstain();

    return {
      content: claims.map((claim) => claim.text).join(' '),
      claims,
      abstained: false,
      model: this.model,
      provider: 'DETERMINISTIC',
    };
  }

  private abstain(): ChatDraft {
    return {
      content: '',
      claims: [],
      abstained: true,
      model: this.model,
      provider: 'DETERMINISTIC',
    };
  }
}

function contentTerms(text: string): Set<string> {
  const terms = new Set<string>();
  for (const word of text.toLowerCase().match(WORD_PATTERN) ?? []) {
    if (word.length < 2) continue;
    if (STOPWORDS.has(word)) continue;
    terms.add(word);
  }
  return terms;
}

function overlapScore(questionTerms: Set<string>, sentence: string): number {
  const words = sentence.toLowerCase().match(WORD_PATTERN) ?? [];
  let hits = 0;
  const matched = new Set<string>();
  for (const word of words) {
    if (questionTerms.has(word) && !matched.has(word)) {
      matched.add(word);
      hits += 1;
    }
  }
  if (hits === 0) return 0;
  // Length-normalised so a long sentence does not win on sheer size alone.
  return hits / Math.sqrt(words.length + 1);
}
