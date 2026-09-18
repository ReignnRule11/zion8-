# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile --filter @zion8/api...

FROM deps AS build
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY apps/api/prisma apps/api/prisma
COPY apps/api/package.json apps/api/package.json
RUN pnpm --filter @zion8/api prisma:generate

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 10001 zion8 \
  && useradd --system --uid 10001 --gid 10001 --home /app --shell /usr/sbin/nologin zion8 \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=zion8:zion8 /repo/apps/api/prisma ./prisma
COPY --from=build --chown=zion8:zion8 /repo/apps/api/package.json ./package.json
COPY --from=build --chown=zion8:zion8 /repo/node_modules ./node_modules
USER 10001
ENTRYPOINT ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
