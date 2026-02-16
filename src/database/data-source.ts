import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { UserEntity } from '../modules/auth/entities/user.entity';

function loadEnvFile(filePath: string): void {
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

const nodeEnv = process.env['NODE_ENV'] ?? 'develop';
const rootDir = process.cwd();

loadEnvFile(join(rootDir, `.env.${nodeEnv}.local`));
loadEnvFile(join(rootDir, `.env.${nodeEnv}`));
loadEnvFile(join(rootDir, '.env'));

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for TypeORM DataSource');
}

const useSsl = (process.env['DATABASE_SSL'] ?? 'true') === 'true';

const appDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  entities: [UserEntity],
  migrations: ['src/database/migrations/*.ts']
});

export default appDataSource;
