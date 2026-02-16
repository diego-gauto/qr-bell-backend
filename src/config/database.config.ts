export const databaseConfig = {
  url: process.env['DATABASE_URL'] ?? '',
  ssl: (process.env['DATABASE_SSL'] ?? 'true') === 'true'
};
