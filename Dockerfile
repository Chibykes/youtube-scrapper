# syntax=docker/dockerfile:1.7
# Target: small VPS. Cap heap, keep runner tiny via Next standalone output.

FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1 \
  CI=1 \
  npm_config_jobs=1 \
  UV_THREADPOOL_SIZE=2

# --- deps ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
  npm ci --no-audit --no-fund

# --- build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* inlined at `next build`. .dockerignore strips .env*, so pass
# keys here or the client bundle ships with empty Clerk / Paystack config.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
ARG NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
ARG NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
ARG NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
ARG NEXT_PUBLIC_YOSE_NGN_RATE=100
ARG NEXT_PUBLIC_APP_URL

ENV NODE_OPTIONS="--max-old-space-size=768" \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} \
  NEXT_PUBLIC_CLERK_SIGN_IN_URL=${NEXT_PUBLIC_CLERK_SIGN_IN_URL} \
  NEXT_PUBLIC_CLERK_SIGN_UP_URL=${NEXT_PUBLIC_CLERK_SIGN_UP_URL} \
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=${NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL} \
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=${NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL} \
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=${NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY} \
  NEXT_PUBLIC_YOSE_NGN_RATE=${NEXT_PUBLIC_YOSE_NGN_RATE} \
  NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npm run build \
  && rm -rf .next/cache

# --- run ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=2233 \
  HOSTNAME=0.0.0.0 \
  NODE_OPTIONS="--max-old-space-size=384" \
  UV_THREADPOOL_SIZE=2

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 2233

CMD ["node", "server.js"]
