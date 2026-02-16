import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces/nest-application.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

interface HomeResponse {
  id: string;
}

interface RingResponse {
  id: string;
  status: string;
}

interface FetchJsonResponse<T> {
  status: number;
  json: T;
}

function loadEnvFileIfExists(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

describe('Stage 4 Hardening E2E', () => {
  let app: INestApplication;
  let baseUrl = '';

  beforeAll(async () => {
    const rootDir = process.cwd();
    loadEnvFileIfExists(join(rootDir, '.env.develop'));
    loadEnvFileIfExists(join(rootDir, '.env'));

    process.env['GLOBAL_RATE_LIMIT_MAX'] = '3';
    process.env['GLOBAL_RATE_LIMIT_WINDOW_MS'] = '60000';
    process.env['RING_RATE_LIMIT_MAX'] = '2';
    process.env['RING_RATE_LIMIT_WINDOW_MS'] = '60000';

    process.env['VAPID_PUBLIC_KEY'] = process.env['VAPID_PUBLIC_KEY'] ?? 'test-public-key';
    process.env['VAPID_PRIVATE_KEY'] = process.env['VAPID_PRIVATE_KEY'] ?? 'test-private-key';
    process.env['VAPID_SUBJECT'] = process.env['VAPID_SUBJECT'] ?? 'mailto:test@example.com';

    if (!process.env['DATABASE_URL']) {
      throw new Error('DATABASE_URL is required to run Stage 4 E2E tests');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );
    await app.listen(0);

    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function fetchJson<T>(
    path: string,
    init?: RequestInit,
    clientIp?: string
  ): Promise<FetchJsonResponse<T>> {
    const headers = new Headers(init?.headers);
    headers.set(
      'x-forwarded-for',
      clientIp ?? `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    );

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers
    });
    const json = (await response.json()) as T;
    return {
      status: response.status,
      json
    };
  }

  async function registerAndLoginOwner(label: string): Promise<AuthResponse> {
    const email = `${label}.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.com`;
    const password = 'Stage4Pass123!';

    const registerResponse = await fetchJson<AuthResponse>('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        name: `Owner ${label}`
      })
    });

    expect(registerResponse.status).toBe(201);
    return registerResponse.json;
  }

  it('runs auth + homes + push registration + ring integration flow', async () => {
    const auth = await registerAndLoginOwner('flow');

    const createHome = await fetchJson<HomeResponse>('/homes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Casa Flow',
        address: 'Calle QA 123'
      })
    });

    expect(createHome.status).toBe(201);
    const homeId = createHome.json.id;
    expect(homeId).toBeTruthy();

    const listHomes = await fetchJson<unknown[]>('/homes', {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`
      }
    });
    expect(listHomes.status).toBe(200);
    expect(listHomes.json.length).toBeGreaterThanOrEqual(1);

    const subscribePush = await fetchJson<{ id: string }>('/push/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: {
          endpoint: `https://example.com/subscriptions/${Date.now()}`,
          expirationTime: null,
          keys: {
            p256dh: 'p256dh-value',
            auth: 'auth-value'
          }
        },
        userAgent: 'stage4-e2e'
      })
    });
    expect(subscribePush.status).toBe(201);
    expect(subscribePush.json.id).toBeTruthy();

    const ring = await fetchJson<RingResponse>('/ring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        homeId
      })
    });
    expect(ring.status).toBe(201);
    expect(ring.json.status).toBe('ringing');

    const accept = await fetchJson<RingResponse>(`/calls/${ring.json.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'accepted'
      })
    });
    expect(accept.status).toBe(200);
    expect(accept.json.status).toBe('accepted');
  });

  it('enforces global rate limiting', async () => {
    const globalIp = '203.0.113.10';
    const requestBody = JSON.stringify({
      refreshToken: 'invalid-token'
    });

    const attempt1 = await fetchJson<{ message?: string | string[] }>(
      '/auth/refresh',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
      },
      globalIp
    );
    const attempt2 = await fetchJson<{ message?: string | string[] }>(
      '/auth/refresh',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
      },
      globalIp
    );
    const attempt3 = await fetchJson<{ message?: string | string[] }>(
      '/auth/refresh',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
      },
      globalIp
    );
    const attempt4 = await fetchJson<{ message?: string | string[] }>(
      '/auth/refresh',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
      },
      globalIp
    );

    expect(attempt1.status).toBe(401);
    expect(attempt2.status).toBe(401);
    expect(attempt3.status).toBe(401);
    expect(attempt4.status).toBe(429);
  });

  it('enforces stricter ring endpoint rate limiting', async () => {
    const setupIp = '203.0.113.20';
    const ringIp = '203.0.113.21';
    const auth = await registerAndLoginOwner('ring-limit');

    const createHome = await fetchJson<HomeResponse>('/homes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Casa Ring Limit'
      })
    }, setupIp);
    expect(createHome.status).toBe(201);

    const homeId = createHome.json.id;
    const body = JSON.stringify({ homeId });

    const firstRing = await fetchJson<RingResponse>('/ring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    }, ringIp);
    const secondRing = await fetchJson<RingResponse>('/ring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    }, ringIp);
    const thirdRing = await fetchJson<{ message?: string | string[] }>('/ring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    }, ringIp);

    expect(firstRing.status).toBe(201);
    expect(secondRing.status).toBe(201);
    expect(thirdRing.status).toBe(429);
  });
});
