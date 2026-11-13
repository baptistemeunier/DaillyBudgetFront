# syntax=docker/dockerfile:1
# Nuxt SPA + Nitro server (API proxy + OAuth token exchange).
# The Nitro output is self-contained: no node_modules in the final image.

FROM docker.io/library/node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM docker.io/library/node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.output ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1
CMD ["node", "server/index.mjs"]
