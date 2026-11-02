# Production image for the FarmFair client (static build served by nginx).
#
# Build from the REPO ROOT so the npm workspace (shared + client) resolves:
#   docker build -f client/Dockerfile -t farmfair-client .
#
# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY client/package.json client/package.json
# npm workspaces resolves every path in the root "workspaces" array, so the
# server manifest must exist here too even though this image never builds it.
COPY server/package.json server/package.json
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared ./shared
COPY client ./client
RUN npm run build -w shared && npm run build -w client

FROM nginx:1.27-alpine AS runtime
# nginx's docker-entrypoint.d runs envsubst on every *.template file here and
# writes the result to /etc/nginx/conf.d/ before starting, which is how
# ${FARMFAIR_API_UPSTREAM} gets filled in from the container's environment.
COPY client/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/client/dist /usr/share/nginx/html
# nginx:alpine already runs its worker processes as the unprivileged
# "nginx" user; only the master process needs root to bind port 80.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
