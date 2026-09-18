# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile --filter @zion8/web...

FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @zion8/contracts build && pnpm --filter @zion8/web build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 10001 zion8 \
  && useradd --system --uid 10001 --gid 10001 --home /app --shell /usr/sbin/nologin zion8 \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=zion8:zion8 /repo/apps/web/.next/standalone ./
COPY --from=build --chown=zion8:zion8 /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=zion8:zion8 /repo/apps/web/public ./apps/web/public
USER 10001
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
ENTRYPOINT ["node", "apps/web/server.js"]
