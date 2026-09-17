import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * Relationships between members, and the graph derived from them.
 *
 * A relationship is stored once, from one member to another, with a `type` that
 * describes how `fromMember` relates to `toMember`. The inverse edge is derived
 * (`PARENT` -> `CHILD`, `MENTOR` -> `MENTEE`) so the two directions can never
 * disagree, which is what makes the graph trustworthy.
 */

export const RelationshipType = {
  SPOUSE: 'SPOUSE',
  PARENT: 'PARENT',
  CHILD: 'CHILD',
  SIBLING: 'SIBLING',
  GUARDIAN: 'GUARDIAN',
  WARD: 'WARD',
  GRANDPARENT: 'GRANDPARENT',
  GRANDCHILD: 'GRANDCHILD',
  RELATIVE: 'RELATIVE',
  MENTOR: 'MENTOR',
  MENTEE: 'MENTEE',
  FRIEND: 'FRIEND',
  EMERGENCY_CONTACT: 'EMERGENCY_CONTACT',
  OTHER: 'OTHER',
} as const;

export type RelationshipType = (typeof RelationshipType)[keyof typeof RelationshipType];

export const relationshipTypeSchema = z.enum(
  Object.values(RelationshipType) as [RelationshipType, ...RelationshipType[]],
);

/**
 * Types whose inverse is a different type. Everything else is symmetric, so the
 * reverse edge is the same type pointing the other way.
 */
export const RELATIONSHIP_INVERSE: Readonly<Partial<Record<RelationshipType, RelationshipType>>> = {
  [RelationshipType.PARENT]: RelationshipType.CHILD,
  [RelationshipType.CHILD]: RelationshipType.PARENT,
  [RelationshipType.GUARDIAN]: RelationshipType.WARD,
  [RelationshipType.WARD]: RelationshipType.GUARDIAN,
  [RelationshipType.GRANDPARENT]: RelationshipType.GRANDCHILD,
  [RelationshipType.GRANDCHILD]: RelationshipType.GRANDPARENT,
  [RelationshipType.MENTOR]: RelationshipType.MENTEE,
  [RelationshipType.MENTEE]: RelationshipType.MENTOR,
};

export function inverseRelationship(type: RelationshipType): RelationshipType {
  return RELATIONSHIP_INVERSE[type] ?? type;
}

export function isSymmetricRelationship(type: RelationshipType): boolean {
  return RELATIONSHIP_INVERSE[type] === undefined;
}

export const relationshipSchema = z
  .object({
    fromMemberId: uuidSchema,
    toMemberId: uuidSchema,
    type: relationshipTypeSchema,
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.fromMemberId !== value.toMemberId, {
    message: 'A member cannot be related to themselves',
    path: ['toMemberId'],
  });

export type RelationshipRequest = z.infer<typeof relationshipSchema>;

export const relationshipResponseSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  fromMemberId: uuidSchema,
  fromMemberName: z.string(),
  toMemberId: uuidSchema,
  toMemberName: z.string(),
  type: relationshipTypeSchema,
  inverseType: relationshipTypeSchema,
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type RelationshipResponse = z.infer<typeof relationshipResponseSchema>;

export const relationshipListQuerySchema = paginationQuerySchema.extend({
  memberId: uuidSchema.optional(),
  type: relationshipTypeSchema.optional(),
});

export type RelationshipListQuery = z.infer<typeof relationshipListQuerySchema>;

export const relationshipPageSchema = paginatedSchema(relationshipResponseSchema);

export type RelationshipPage = z.infer<typeof relationshipPageSchema>;

export const GraphNodeType = {
  MEMBER: 'MEMBER',
  FAMILY: 'FAMILY',
  DEPARTMENT: 'DEPARTMENT',
  VOLUNTEER_ROLE: 'VOLUNTEER_ROLE',
} as const;

export type GraphNodeType = (typeof GraphNodeType)[keyof typeof GraphNodeType];

export const graphNodeTypeSchema = z.enum(
  Object.values(GraphNodeType) as [GraphNodeType, ...GraphNodeType[]],
);

export const GraphEdgeType = {
  RELATIONSHIP: 'RELATIONSHIP',
  FAMILY: 'FAMILY',
  DEPARTMENT: 'DEPARTMENT',
  VOLUNTEER: 'VOLUNTEER',
} as const;

export type GraphEdgeType = (typeof GraphEdgeType)[keyof typeof GraphEdgeType];

export const graphEdgeTypeSchema = z.enum(
  Object.values(GraphEdgeType) as [GraphEdgeType, ...GraphEdgeType[]],
);

export const MAX_GRAPH_DEPTH = 3;
export const MAX_GRAPH_NODES = 300;

export const relationshipGraphQuerySchema = z.object({
  memberId: uuidSchema,
  depth: z.coerce.number().int().min(1).max(MAX_GRAPH_DEPTH).default(2),
  includeFamilies: z.coerce.boolean().default(true),
  includeDepartments: z.coerce.boolean().default(true),
  includeVolunteerRoles: z.coerce.boolean().default(false),
  types: z
    .union([relationshipTypeSchema, z.array(relationshipTypeSchema)])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional(),
});

export type RelationshipGraphQuery = z.infer<typeof relationshipGraphQuerySchema>;

export const graphNodeSchema = z.object({
  id: uuidSchema,
  type: graphNodeTypeSchema,
  label: z.string(),
  depth: z.number().int().min(0),
  root: z.boolean(),
  memberStatus: z.string().nullable(),
  photoUrl: z.string().nullable(),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;

export const graphEdgeSchema = z.object({
  id: z.string(),
  type: graphEdgeTypeSchema,
  source: uuidSchema,
  target: uuidSchema,
  label: z.string(),
});

export type GraphEdge = z.infer<typeof graphEdgeSchema>;

export const relationshipGraphSchema = z.object({
  rootId: uuidSchema,
  depth: z.number().int().min(1),
  truncated: z.boolean(),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type RelationshipGraph = z.infer<typeof relationshipGraphSchema>;
