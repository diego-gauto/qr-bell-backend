# QR Bell Backend

NestJS API for QR Bell auth, homes, ring events, and push notifications.

## Commands
- `pnpm install`
- `pnpm dev`
- `pnpm start:dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`

## Deploy
- Platform: Railway or Render
- Database: Neon PostgreSQL

## Environment
Use `.env.develop` for local development.

Supported load order:
1. `.env.<NODE_ENV>.local`
2. `.env.<NODE_ENV>`
3. `.env`

Templates committed:
- `.env.example`
- `.env.develop.example`

Rate-limit env vars:
- `GLOBAL_RATE_LIMIT_MAX`
- `GLOBAL_RATE_LIMIT_WINDOW_MS`
- `RING_RATE_LIMIT_MAX`
- `RING_RATE_LIMIT_WINDOW_MS`
