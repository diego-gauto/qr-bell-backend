export const jwtConfig = {
  accessSecret: process.env['JWT_SECRET'] ?? '',
  accessExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
  refreshSecret: process.env['REFRESH_TOKEN_SECRET'] ?? '',
  refreshExpiresIn: process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '7d'
};
