# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile --filter @zion8/api...

FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @zion8/contracts build \
  && pnpm --filter @zion8/api prisma:generate \
  && pnpm --filter @zion8/api build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 10001 zion8 \
  && useradd --system --uid 10001 --gid 10001 --home /app --shell /usr/sbin/nologin zion8 \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=zion8:zion8 /repo/apps/api/dist ./dist
COPY --from=build --chown=zion8:zion8 /repo/apps/api/prisma ./prisma
COPY --from=build --chown=zion8:zion8 /repo/apps/api/package.json ./package.json
COPY --from=build --chown=zion8:zion8 /repo/node_modules ./node_modules
USER 10001
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health/live >/dev/null || exit 1
ENTRYPOINT ["node", "dist/main.js"]
