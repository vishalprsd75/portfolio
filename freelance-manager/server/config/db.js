import { PrismaClient } from '@prisma/client';

// Detect connection string from Neon / Vercel Postgres environment variables
function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_PRISMA_URL) return process.env.POSTGRES_PRISMA_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.STORAGE_URL) return process.env.STORAGE_URL;
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string' && (v.startsWith('postgres://') || v.startsWith('postgresql://'))) {
      return v;
    }
  }
  return '';
}

const dbUrl = getDatabaseUrl();

if (dbUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = dbUrl;
}

const prisma = new PrismaClient({
  ...(dbUrl ? {
    datasourceUrl: dbUrl,
    datasources: { db: { url: dbUrl } },
  } : {}),
  log: ['error'],
});

export { prisma };
