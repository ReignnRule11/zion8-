# 2. Zion AI answers cite the church's records, or it refuses

- **Status:** Accepted
- **Date:** 2026-09-16
- **Context:** Zion AI answers questions about a church's own history, documents,
  sermons, and people. A confident answer that is wrong is not merely unhelpful:
  it can be repeated from a pulpit, entered into a pastoral record, or used to
  make a decision about a person. The users are pastors and administrators, not
  engineers evaluating a model's tone.

## Decision

Every generated answer must be supported by retrieved passages that the server
can verify. When the evidence is insufficient, Zion AI returns an explicit
abstention together with the passages it did find. It never fills a gap with
plausible prose.

Concretely, the server — not the prompt — enforces:

1. The model receives only passages retrieved for this request, within this
   tenant, filtered by the caller's permissions.
2. The model returns structured output whose claims carry citation markers.
3. The server discards any marker referencing a chunk that was not supplied or is
   not permitted.
4. If the fraction of claims with valid citations falls below
   `AI_CITATION_MIN_SUPPORT`, the answer is downgraded to extractive quotes or
   refused.
5. Retrieved text is labelled untrusted, and the model cannot select a tenant,
   write SQL, or invoke a tool, so instruction-like content in a document cannot
   change what the system does.

## Rationale

- A citation makes an answer **checkable**. A pastor can open the minute book page
  or play the sermon at the timestamp and confirm it, which converts a trust
  problem into a verification step.
- Abstention is honest, and honest is more useful than fluent. "I could not find
  this in the archive; here are the closest passages" leads somewhere. An
  invented date does not.
- Enforcement in code rather than in the prompt is the only version that survives
  a model upgrade, a prompt edit, or an adversarial document.

## Trade-offs accepted

- More refusals than a system optimized for answer rate. This is intended: a
  refusal is a correct outcome for an unanswerable question.
- Answers can be shorter and more quotation-heavy than free-form prose.
- An additional verification step adds latency and code: a retrieval that finds
  nothing useful must be distinguished from a failure, and both must be
  presented clearly.

## Consequences

- Every persisted answer stores its sources (chunk ids), model, prompt version,
  and embedding model, so any answer can be reproduced and audited.
- The evaluation harness includes a **should-refuse** dataset, and refusal
  correctness is a first-class metric alongside faithfulness and citation
  precision.
- Retrieval without generation (Church Knowledge Search) is not a degraded mode;
  it is a first-class capability and the fallback when no model is configured.
