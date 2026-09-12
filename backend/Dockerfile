# syntax=docker/dockerfile:1

# ---------- Etapa 1: dependencias e build ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ---------- Etapa 2: dependencias de producao ----------
FROM node:22-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Etapa 3: runtime ----------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# dumb-init garante o encaminhamento correto de SIGTERM (shutdown gracioso).
RUN apk add --no-cache dumb-init curl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S api -u 1001 -G nodejs

COPY --from=deps  --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/dist ./dist
COPY --chown=api:nodejs package.json ./

RUN mkdir -p /app/uploads && chown -R api:nodejs /app/uploads

USER api
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3333/api/v1/health/ready || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
