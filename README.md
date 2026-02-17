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
### Platform
- Backend: Railway (recommended) or Render
- Database: Neon PostgreSQL

### Build/Start
- Build: `pnpm install --frozen-lockfile && pnpm build`
- Start: `pnpm start` (listens on `PORT`)

### Migrations
Run on deploy (Railway "Deploy Command" or Render "Pre-Deploy Command"):
- `pnpm migration:run`

### Production Env Vars (required)
- `DATABASE_URL` (Neon pooled URL, with `sslmode=require`)
- `DATABASE_SSL` (`true`)
- `PORT` (set by platform)
- `CORS_ORIGIN` (your Vercel frontend origin, e.g. `https://<app>.vercel.app`)
- `FRONTEND_APP_URL` (same as `CORS_ORIGIN`)
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (default `15m`)
- `REFRESH_TOKEN_SECRET`
- `REFRESH_TOKEN_EXPIRES_IN` (default `7d`)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (format: `mailto:you@example.com`)

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
