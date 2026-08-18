# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (better Docker layer caching)
COPY package*.json ./
RUN npm ci

# Copy source
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npx tsc

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS and Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Create storage directory for uploaded files
RUN mkdir -p /app/storage

EXPOSE 3002

# Run database migrations/schema deployment then start server
CMD ["sh", "-c", "npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate && node dist/index.js"]
