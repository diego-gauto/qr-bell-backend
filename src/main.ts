import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.replace(/^['"]|['"]$/g, ''))
    .map((value) => value.replace(/\/+$/, ''));
}

function buildCorsOriginChecker(allowedOrigins: string[]) {
  const allowedSet = new Set(allowedOrigins);

  const vercelPrefixes = allowedOrigins
    .map((origin) => {
      try {
        return new URL(origin).hostname;
      } catch {
        return '';
      }
    })
    .filter((hostname) => hostname.endsWith('.vercel.app'))
    .map((hostname) => hostname.replace(/\.vercel\.app$/, ''))
    .filter((prefix) => prefix.length > 0);

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Non-browser callers (curl/health checks) don't send Origin.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedSet.has(origin)) {
      callback(null, true);
      return;
    }

    // Allow Vercel deployment URLs for the same project (hash subdomains).
    // Example: https://qr-bell-frontend-g76163m4s-xxx.vercel.app
    try {
      const { hostname, protocol } = new URL(origin);
      if (protocol === 'https:' && hostname.endsWith('.vercel.app')) {
        const subdomain = hostname.replace(/\.vercel\.app$/, '');
        const allowedByPrefix = vercelPrefixes.some(
          (prefix) => subdomain === prefix || subdomain.startsWith(`${prefix}-`)
        );
        if (allowedByPrefix) {
          callback(null, true);
          return;
        }
      }
    } catch {
      // Fall through.
    }

    callback(new Error(`CORS: Origin no permitido: ${origin}`), false);
  };
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    }),
  );

  const corsRaw = process.env['CORS_ORIGIN'] ?? 'http://localhost:3000';
  const allowedOrigins = parseCorsOrigins(corsRaw);

  app.enableCors({
    origin: buildCorsOriginChecker(allowedOrigins),
    credentials: true
  });

  const port = process.env['PORT'] ? Number(process.env['PORT']) : 4000;
  await app.listen(port);
}

void bootstrap();
