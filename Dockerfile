FROM node:20-alpine AS deps
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY web ./web
WORKDIR /app/web
RUN npm run build || npm run build:prod || npm run build --if-present

FROM node:20-alpine AS runner
WORKDIR /app/web
ENV NODE_ENV=production
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
