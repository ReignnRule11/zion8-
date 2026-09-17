import type { Metadata } from 'next';
import { Permission, RelationshipType, relationshipTypeSchema } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  Badge,
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  SectionHeading,
} from '@/components/membership/ui';
import { MemberOptions } from '@/components/membership/member-options';
import { RelationshipGraphForm } from '@/components/membership/relationship-graph-form';
import { RemoveRelationshipGraphButton } from '@/components/membership/remove-relationship-graph-button';

export const metadata: Metadata = { title: 'Relationships' };

const PAGE_SIZE = 25;
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const RING_RADIUS = 130;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;

interface Point {
  x: number;
  y: number;
}

/**
 * Lays the graph out deterministically: the root sits in the centre and every
 * subsequent depth occupies a concentric ring. No physics simulation is needed
 * for a depth-limited graph, and a stable layout is easier to read.
 */
function layoutGraph(
  nodes: Array<{ id: string; root: boolean; depth: number; label: string; type: string }>,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  const byDepth = new Map<number, string[]>();
  let deepest = 0;

  for (const node of nodes) {
    if (node.root) positions.set(node.id, { x: CENTER_X, y: CENTER_Y });
    else {
      const ring = byDepth.get(node.depth) ?? [];
      ring.push(node.id);
      byDepth.set(node.depth, ring);
      deepest = Math.max(deepest, node.depth);
    }
  }

  for (const [depth, ids] of byDepth) {
    const radius = Math.min(RING_RADIUS * depth, Math.min(CENTER_X, CENTER_Y) - 40);
    ids.forEach((id, index) => {
      const angle = (2 * Math.PI * index) / ids.length - Math.PI / 2;
      positions.set(id, {
        x: CENTER_X + radius * Math.cos(angle),
        y: CENTER_Y + radius * Math.sin(angle),
      });
    });
  }

  void deepest;
  return positions;
}

export default async function RelationshipsPage({
  searchParams,
}: {
  searchParams: Promise<{
    memberId?: string;
    type?: string;
    offset?: string;
    limit?: string;
  }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.RELATIONSHIP_READ)) {
    return <EmptyState message="You do not have permission to view relationships." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const memberId = params.memberId?.trim() || undefined;
  const type = params.type ? relationshipTypeSchema.safeParse(params.type.toUpperCase()) : null;
  const canManage = can(me, Permission.RELATIONSHIP_MANAGE);

  const [page, memberPage, graph] = await Promise.all([
    api.listRelationships(token, {
      limit,
      offset,
      memberId,
      type: type?.success ? type.data : undefined,
    }),
    canManage
      ? api.listMembers(token, { limit: 200, offset: 0 })
      : Promise.resolve({ items: [] as Array<{ id: string; fullName: string }> }),
    memberId
      ? api.relationshipGraph(token, {
          memberId,
          depth: 2,
          includeFamilies: true,
          includeDepartments: true,
          includeVolunteerRoles: false,
        })
      : Promise.resolve(null),
  ]);

  const members = memberPage.items.map((member) => ({ id: member.id, fullName: member.fullName }));
  const positions = graph ? layoutGraph(graph.nodes) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relationships"
        description="Who is connected to whom, stored once and mirrored so both directions agree."
      />

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            <label htmlFor="memberId" className="text-xs uppercase tracking-wide text-slate-500">
              Focus member
            </label>
            <select
              id="memberId"
              name="memberId"
              defaultValue={memberId ?? ''}
              className={inputClass}
            >
              <option value="">All relationships</option>
              <MemberOptions members={members} />
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="type" className="text-xs uppercase tracking-wide text-slate-500">
              Type
            </label>
            <select id="type" name="type" defaultValue={type?.success ? type.data : ''} className={inputClass}>
              <option value="">Any type</option>
              {Object.values(RelationshipType).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Apply filters
          </button>
        </form>
      </Card>

      {graph && positions ? (
        <Card>
          <SectionHeading
            title="Relationship graph"
            description={`${graph.nodes.length} nodes, ${graph.edges.length} edges${
              graph.truncated ? ' · truncated to the configured limits' : ''
            }`}
          />
          <div className="mt-4 overflow-x-auto">
            <svg
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              className="h-auto w-full min-w-[40rem]"
              role="img"
              aria-label="Relationship graph"
            >
              {graph.edges.map((edge) => {
                const source = positions.get(edge.source);
                const target = positions.get(edge.target);
                if (!source || !target) return null;
                return (
                  <g key={edge.id}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="rgba(148,163,184,0.4)"
                      strokeWidth={1.5}
                    />
                    <text
                      x={(source.x + target.x) / 2}
                      y={(source.y + target.y) / 2 - 4}
                      textAnchor="middle"
                      className="fill-slate-400"
                      fontSize={10}
                    >
                      {humanize(edge.label)}
                    </text>
                  </g>
                );
              })}
              {graph.nodes.map((node) => {
                const point = positions.get(node.id);
                if (!point) return null;
                return (
                  <g key={node.id}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={node.root ? 30 : 22}
                      fill={node.root ? 'rgba(99,102,241,0.45)' : 'rgba(148,163,184,0.2)'}
                      stroke={node.root ? 'rgba(129,140,248,0.9)' : 'rgba(148,163,184,0.5)'}
                      strokeWidth={1.5}
                    />
                    <text
                      x={point.x}
                      y={point.y + (node.root ? 46 : 36)}
                      textAnchor="middle"
                      className="fill-slate-200"
                      fontSize={11}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Card>
      ) : null}

      {canManage && memberId ? (
        <Card>
          <SectionHeading title="Record a relationship" />
          <div className="mt-4">
            <RelationshipGraphForm fromMemberId={memberId} members={members} />
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionHeading title="All relationships" description={`${page.total} recorded`} />
        {page.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No relationships recorded yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {page.items.map((relationship) => (
              <li
                key={relationship.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-200">
                    {relationship.fromMemberName} → {relationship.toMemberName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Recorded {formatDate(relationship.createdAt)}
                    {relationship.notes ? ` · ${relationship.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="info">{humanize(relationship.type)}</Badge>
                  <Badge>{humanize(relationship.inverseType)}</Badge>
                  {canManage ? (
                    <RemoveRelationshipGraphButton relationshipId={relationship.id} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Pagination
            basePath="/community/relationships"
            limit={limit}
            offset={offset}
            total={page.total}
            filters={{ memberId, type: type?.success ? type.data : undefined }}
          />
        </div>
      </Card>
    </div>
  );
}
