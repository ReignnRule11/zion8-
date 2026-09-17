# Membership

The membership domain is the record of who belongs to a church, how they are
connected to one another, and what they have done. It is the deepest part of
Zion8: everything else (community, giving, events, care) is anchored to a member
or a family.

It is delivered as one module, `apps/api/src/modules/membership`, exposed over two
transports that share the same contracts, services, and permissions:

- **REST** at `/api/v1/membership` for CRUD, uploads, and streaming.
- **GraphQL** at `/api/v1/graphql` (Apollo, code-first) for graphs and profiles.

## Aggregates

| Aggregate | Root | Notes |
|-----------|------|-------|
| Member | `members` | The person. Never hard-deleted; archived instead. |
| Family | `families` + `family_members` | A household with roles (HEAD, SPOUSE, CHILD...). |
| Relationship | `relationships` | Stored once; the inverse edge is derived. |
| Visitor | `visitors` + `visitor_visits` | A guest, before they belong. Its own aggregate. |
| Attendance | `attendance_sessions` + `attendance_records` | Recorded per session, not per member. |
| Department | `departments` + `department_members` | Operational teams (ushering, choir, media). |
| Volunteer role | `volunteer_roles` + `volunteer_assignments` | Roles that can be under-filled, and who fills them. |
| Timeline | `member_timeline_entries` | Append-only journal of what happened. |
| Document | `member_documents` | Metadata-first; bytes behind a storage port. |
| Summary | `member_ai_summaries` | A persisted projection, not a live AI call. |

A **member is deliberately separate from the global `User`**. A user is an
identity that can sign in; a member is a person on the church's roll. Many
members have no account, and a user is linked to at most one member per tenant.
This keeps pastoral records complete even for people who never log in.

A **relationship is stored in one direction only**. `PARENT` derives `CHILD`,
`MENTOR` derives `MENTEE`; everything else is symmetric. Because there is a single
row, the two directions can never disagree, which is what makes the relationship
graph trustworthy.

**Attendance records reference a member XOR a visitor**. A first-time guest can be
counted on the day they arrive without first becoming a member, so the Sunday
report is complete without forcing a conversion.

## Recording is a side effect, not a second write

Every meaningful change writes a timeline entry in the *same transaction* as the
change itself. A member created, a family joined, a department left, a document
uploaded, a visitor converted: each appends an entry through
`TimelineService.record`. The caller supplies a `dedupeKey`, so a retried request
cannot double-write history.

Only `NOTE` entries are authored by a person (`MANUAL_TIMELINE_TYPES`). Everything
else is derived from the fact that produced it, which means the timeline cannot
drift from the record it describes.

## AI summaries are a projection

A summary is not generated on read. It is a row that records:

- the `provider` (`DETERMINISTIC` or `LLM`) and the `model`,
- the structured `facts` it was built from (tenure, attendance rate, streak,
  family and relationship counts, open follow-ups...),
- the `sourceVersion` of the member's data at the time, and
- `generatedAt`, `status`, and any `error`.

Because the facts and the source version are persisted, a **stale** summary is
detectable (`status = STALE`) and regeneration is explainable. The provider is a
port: a deterministic analyzer by default, an HTTP LLM when the workspace
configures one. A workspace without an LLM still gets summaries.

## Documents are metadata-first

`member_documents` holds the record (title, category, size, checksum, expiry,
status) and the bytes live behind a storage port — local disk in development,
object storage in production. The record survives independently of the bytes.

Binary upload is **REST only** (`multipart`-free: base64 in the JSON body,
`MAX_DOCUMENT_BYTES` = 512 KiB decoded, allow-listed content types). GraphQL
exposes document metadata and download URLs, never a binary field. This keeps the
GraphQL schema clean and avoids the well-known pitfalls of downloading through a
resolver.

## Multi-tenancy

Every membership table carries `tenant_id` and is protected by PostgreSQL
row-level security with `FORCE ROW LEVEL SECURITY`. All reads and writes go
through `PrismaService.withTenant(tenantId, ...)`, which sets the transaction-local
`app.current_tenant`; the application role is `NOBYPASSRLS`. A query written
without a tenant scope returns nothing rather than another church's data.

## Permissions

Authorization is transport-agnostic. Handlers declare `@RequirePermissions(...)`
and the guard resolves the principal from either the HTTP request or the GraphQL
context, so the same permission applies no matter how the operation was called.

| Permission | Guards |
|------------|--------|
| `member:read` / `member:create` / `member:update` / `member:archive` | Member lifecycle |
| `family:read` / `family:manage` | Families and their members |
| `relationship:read` / `relationship:manage` | Relationships and the graph |
| `visitor:read` / `visitor:create` / `visitor:update` / `visitor:manage` | Visitor funnel |
| `attendance:read` / `attendance:record` / `attendance:manage` | Sessions, marking, closing |
| `department:read` / `department:manage` | Departments and membership |
| `volunteer:read` / `volunteer:manage` | Volunteer roles and assignments |
| `timeline:read` / `timeline:manage` | Timeline and manual notes |
| `document:read` / `document:upload` / `document:manage` | Document metadata and bytes |
| `summary:read` / `summary:generate` | AI summaries |

## REST surface

```
POST   /membership/members
GET    /membership/members
GET    /membership/members/:memberId
GET    /membership/members/:memberId/profile
PATCH  /membership/members/:memberId
DELETE /membership/members/:memberId                    archive, never delete

POST   /membership/families
GET    /membership/families
GET    /membership/families/:familyId
PATCH  /membership/families/:familyId
POST   /membership/families/:familyId/members
DELETE /membership/families/:familyId/members/:memberId

POST   /membership/relationships
GET    /membership/relationships
GET    /membership/relationships/graph
DELETE /membership/relationships/:relationshipId

POST   /membership/visitors
GET    /membership/visitors
GET    /membership/visitors/:visitorId
PATCH  /membership/visitors/:visitorId
POST   /membership/visitors/:visitorId/visits
POST   /membership/visitors/:visitorId/convert

POST   /membership/attendance/sessions
GET    /membership/attendance/sessions
GET    /membership/attendance/sessions/:sessionId
PATCH  /membership/attendance/sessions/:sessionId
POST   /membership/attendance/sessions/:sessionId/close
POST   /membership/attendance/sessions/:sessionId/mark
POST   /membership/attendance/sessions/:sessionId/bulk-mark
GET    /membership/attendance/members/:memberId/stats

POST   /membership/departments
GET    /membership/departments
GET    /membership/departments/:departmentId
PATCH  /membership/departments/:departmentId
POST   /membership/departments/:departmentId/members
PATCH  /membership/departments/:departmentId/members/:memberId
DELETE /membership/departments/:departmentId/members/:memberId

POST   /membership/volunteer-roles
GET    /membership/volunteer-roles
GET    /membership/volunteer-roles/:roleId
PATCH  /membership/volunteer-roles/:roleId
POST   /membership/volunteer-roles/:roleId/assignments
PATCH  /membership/volunteer-roles/:roleId/assignments/:assignmentId
DELETE /membership/volunteer-roles/:roleId/assignments/:assignmentId

GET    /membership/members/:memberId/timeline
POST   /membership/members/:memberId/timeline/notes
DELETE /membership/timeline/notes/:noteId

POST   /membership/members/:memberId/documents
GET    /membership/members/:memberId/documents
PATCH  /membership/documents/:documentId
DELETE /membership/documents/:documentId               archive
GET    /membership/documents/:documentId/download      short-lived URL
GET    /membership/documents/:documentId/content       streams the bytes

GET    /membership/members/:memberId/summary
POST   /membership/members/:memberId/summary
```

## GraphQL surface

Queries: `members`, `member`, `memberProfile`, `families`, `family`,
`relationships`, `relationshipGraph`, `visitors`, `visitor`, `attendanceSessions`,
`attendanceSession`, `memberAttendanceStats`, `departments`, `department`,
`volunteerRoles`, `volunteerRole`, `memberTimeline`, `memberDocuments`,
`memberSummary`, `documentDownloadUrl`.

Mutations: `createMember`, `updateMember`, `archiveMember`, `createFamily`,
`updateFamily`, `addFamilyMember`, `removeFamilyMember`, `createRelationship`,
`removeRelationship`, `createVisitor`, `updateVisitor`, `addVisitorVisit`,
`convertVisitor`, `createAttendanceSession`, `updateAttendanceSession`,
`closeAttendanceSession`, `markAttendance`, `bulkMarkAttendance`,
`createDepartment`, `updateDepartment`, `addDepartmentMember`,
`updateDepartmentMember`, `removeDepartmentMember`, `createVolunteerRole`,
`updateVolunteerRole`, `assignVolunteer`, `updateVolunteerAssignment`,
`endVolunteerAssignment`, `addMemberTimelineNote`, `deleteTimelineNote`,
`updateDocument`, `archiveDocument`, `generateMemberSummary`.

Resolvers are thin adapters. They validate input with the shared Zod contract
through `ZodValidationPipe`, resolve the tenant from the principal, call the same
service the REST controller calls, and return the same shape. Errors are mapped
by `formatError` in `apps/api/src/common/graphql/graphql.config.ts`, which walks
the wrapped `GraphQLError.originalError` chain to find the domain error rather
than relying on `instanceof` (the wrapper is not the error).

## Relationship graph

`GET /membership/relationships/graph` returns the neighbourhood of a member:

- `depth` up to `MAX_GRAPH_DEPTH` (3), bounded by `MAX_GRAPH_NODES` (300);
  exceeding the node budget sets `truncated` rather than failing.
- families, departments, and volunteer roles are optional edge families.
- nodes are typed (`MEMBER`, `FAMILY`, `DEPARTMENT`, `VOLUNTEER_ROLE`) and carry
  their depth and root flag, so a client can lay the graph out without a physics
  engine.

## Web client

The dashboard lives at `apps/web/src/app/(dashboard)`. It is a set of server
components that read the API with the httpOnly session cookie's access token and
render shared UI from `apps/web/src/components/membership`. Client components
hold only ephemeral UI state and post to server actions, which re-validate every
payload with the shared Zod contracts before calling the API.

- Members: `/people`, `/people/new`, `/people/[memberId]`, `/people/[memberId]/edit`.
  The profile shows the AI summary, timeline, relationships, documents, and a
  definition list of identity facts.
- Community: `/community/families`, `/community/visitors`,
  `/community/attendance`, `/community/departments`, `/community/volunteers`,
  `/community/relationships`.

Sections render only what the signed-in principal may do: forms and destructive
controls are gated by `can(me, Permission.*)` computed from
`GET /auth/me`. The attendance session page lays the roster out as a single bulk
submission, which mirrors how a service is actually recorded.

Document bytes never reach the browser directly. The page links to
`/api/membership/documents/[documentId]/content`, a Next.js route handler that
exchanges the httpOnly cookie for a bearer token and streams the API response, so
the token is never exposed to client JavaScript.

## Tests

- `apps/api/test/membership.graphql.e2e.test.ts` — the GraphQL surface (queries,
  mutations, pagination, permission failures, `formatError` mapping) and a REST
  smoke suite covering create, read, list, filter, and `MEMBER_NOT_FOUND`, all
  against real PostgreSQL and Redis.
- `apps/api/src/common/graphql/graphql.config.test.ts` — `formatError` maps domain
  errors, unwraps nested wrappers, and passes unexpected errors through.

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) — the module and layering rules this domain follows.
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — row-level security and `withTenant`.
- [AUTHENTICATION.md](./AUTHENTICATION.md) — principals, permissions, and sessions.
- [CHURCH_ONBOARDING.md](./CHURCH_ONBOARDING.md) — the member import that seeds this domain.
- [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md) — where every file lives.
