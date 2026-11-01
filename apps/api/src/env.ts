// Load variables from apps/api/.env if present.
// Node's built-in loader (20.12+/21.7+) — no runtime dependency needed.
try {
  process.loadEnvFile();
} catch {
  // No .env file found; fall back to the defaults below.
}

export const env = {
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://karnameh:karnameh@localhost:5432/karnameh?schema=public',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5180',
  webAppUrl: process.env.WEB_APP_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:5180',
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
    },
  },
};
