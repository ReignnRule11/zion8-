import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';
import {
  aiAbstentionReasonSchema,
  aiCapabilitySchema,
  aiPassageSchema,
  aiProviderKindSchema,
  aiScopeSchema,
} from './search.schemas';

/**
 * Grounded question answering.
 *
 * An answer is never returned bare. It is a set of claims, each carrying the
 * citations that support it, plus the exact configuration that produced it. When
 * support is insufficient the response is an explicit abstention that still
 * carries the passages retrieval found, so the user sees what the archive holds
 * rather than a dead end.
 */

export const AiMessageRole = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
  SYSTEM: 'SYSTEM',
} as const;

export type AiMessageRole = (typeof AiMessageRole)[keyof typeof AiMessageRole];

export const aiMessageRoleSchema = z.enum(
  Object.values(AiMessageRole) as [AiMessageRole, ...AiMessageRole[]],
);

/** One assertion in an answer, and the passages that support it. */
export const aiAnswerClaimSchema = z.object({
  text: z.string().min(1),
  citationChunkIds: z.array(uuidSchema),
});

export type AiAnswerClaim = z.infer<typeof aiAnswerClaimSchema>;

/**
 * Citation verification outcome. It is persisted with the answer because a
 * reviewer asking "why did it refuse?" needs the reason, not just the result.
 */
export const aiGroundingSchema = z.object({
  totalClaims: z.number().int().min(0),
  supportedClaims: z.number().int().min(0),
  supportRatio: z.number().min(0).max(1),
  droppedCitations: z.number().int().min(0),
  threshold: z.number().min(0).max(1),
});

export type AiGrounding = z.infer<typeof aiGroundingSchema>;

export const aiAskRequestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  capability: aiCapabilitySchema.default('KNOWLEDGE_SEARCH'),
  conversationId: uuidSchema.optional(),
  scope: aiScopeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  stream: z.boolean().default(false),
});

export type AiAskRequest = z.infer<typeof aiAskRequestSchema>;

export const aiAnswerResponseSchema = z.object({
  messageId: uuidSchema,
  conversationId: uuidSchema,
  capability: aiCapabilitySchema,
  answer: z.string().nullable(),
  abstained: z.boolean(),
  abstentionReason: aiAbstentionReasonSchema.nullable(),
  claims: z.array(aiAnswerClaimSchema),
  passages: z.array(aiPassageSchema),
  grounding: aiGroundingSchema,
  provider: aiProviderKindSchema,
  model: z.string().nullable(),
  promptVersion: z.string().nullable(),
  embeddingModel: z.string().nullable(),
  tookMs: z.number().int().min(0),
});

export type AiAnswerResponse = z.infer<typeof aiAnswerResponseSchema>;

export const aiMessageSchema = z.object({
  id: uuidSchema,
  conversationId: uuidSchema,
  role: aiMessageRoleSchema,
  content: z.string(),
  abstained: z.boolean(),
  abstentionReason: aiAbstentionReasonSchema.nullable(),
  citations: z.array(aiPassageSchema),
  provider: aiProviderKindSchema.nullable(),
  model: z.string().nullable(),
  promptVersion: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type AiMessage = z.infer<typeof aiMessageSchema>;

export const aiConversationSchema = z.object({
  id: uuidSchema,
  title: z.string().nullable(),
  capability: aiCapabilitySchema,
  messageCount: z.number().int().min(0),
  lastMessageAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AiConversation = z.infer<typeof aiConversationSchema>;

export const aiConversationDetailSchema = aiConversationSchema.extend({
  messages: z.array(aiMessageSchema),
});

export type AiConversationDetail = z.infer<typeof aiConversationDetailSchema>;

export const aiConversationListQuerySchema = paginationQuerySchema;

export type AiConversationListQuery = z.infer<typeof aiConversationListQuerySchema>;

export const aiConversationPageSchema = paginatedSchema(aiConversationSchema);

export type AiConversationPage = z.infer<typeof aiConversationPageSchema>;

export const aiUpdateConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).nullable().optional(),
});

export type AiUpdateConversationRequest = z.infer<typeof aiUpdateConversationSchema>;

/** Feedback is how online quality signal is gathered for the evaluation harness. */
export const AiFeedbackRating = {
  HELPFUL: 'HELPFUL',
  NOT_HELPFUL: 'NOT_HELPFUL',
  WRONG_CITATION: 'WRONG_CITATION',
  WRONG_ANSWER: 'WRONG_ANSWER',
  MISSING_SOURCE: 'MISSING_SOURCE',
} as const;

export type AiFeedbackRating = (typeof AiFeedbackRating)[keyof typeof AiFeedbackRating];

export const aiFeedbackRatingSchema = z.enum(
  Object.values(AiFeedbackRating) as [AiFeedbackRating, ...AiFeedbackRating[]],
);

export const aiFeedbackSchema = z.object({
  messageId: uuidSchema,
  rating: aiFeedbackRatingSchema,
  comment: z.string().trim().max(2000).optional(),
});

export type AiFeedbackRequest = z.infer<typeof aiFeedbackSchema>;

export const aiFeedbackResponseSchema = z.object({
  messageId: uuidSchema,
  rating: aiFeedbackRatingSchema,
  createdAt: z.string().datetime(),
});

export type AiFeedbackResponse = z.infer<typeof aiFeedbackResponseSchema>;

/**
 * A streamed answer arrives as an ordered sequence of these frames. Text is
 * sent incrementally; the terminal `final` frame carries the same payload as the
 * non-streaming response so a client has one shape to parse either way.
 */
export const AiStreamEventType = {
  DELTA: 'delta',
  CITATIONS: 'citations',
  FINAL: 'final',
  ERROR: 'error',
} as const;

export type AiStreamEventType = (typeof AiStreamEventType)[keyof typeof AiStreamEventType];

export const aiStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('citations'), passages: z.array(aiPassageSchema) }),
  z.object({ type: z.literal('final'), response: aiAnswerResponseSchema }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>;
