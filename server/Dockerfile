# Production image for the FarmFair API.
#
# Build from the REPO ROOT so the npm workspace (shared + server) resolves:
#   docker build -f server/Dockerfile -t farmfair-api .
#
# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
# npm workspaces resolves every path in the root "workspaces" array (shared,
# server, client, e2e) even when only installing a subset, so every
# manifest must exist here too even though this image never builds them.
COPY client/package.json client/package.json
COPY e2e/package.json e2e/package.json
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared ./shared
COPY server ./server
RUN npm run build -w shared && npm run build -w server
# Drop devDependencies (tsx, jest, ts-jest, etc.) before they're copied into
# the runtime image - only the compiled dist/ and runtime deps are needed.
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S farmfair && adduser -S farmfair -G farmfair

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY package.json ./

RUN mkdir -p /app/server/uploads && chown -R farmfair:farmfair /app

USER farmfair
WORKDIR /app/server
EXPOSE 4000
CMD ["node", "dist/index.js"]
