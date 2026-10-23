import { PrismaClient } from '@prisma/client';

// Detect connection string from Neon / Vercel Postgres environment variables
const dbUrl = process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_URL ||
  (Object.keys(process.env).find(k => k.endsWith('_URL') && (process.env[k]?.startsWith('postgres://') || process.env[k]?.startsWith('postgresql://')))
    ? process.env[Object.keys(process.env).find(k => k.endsWith('_URL') && (process.env[k]?.startsWith('postgres://') || process.env[k]?.startsWith('postgresql://')))]
    : '');

if (dbUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = dbUrl;
}

const prisma = new PrismaClient({
  ...(dbUrl ? { datasourceUrl: dbUrl } : {}),
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export { prisma };
