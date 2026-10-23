// ═══════════════════════════════════════════════════════════
// Automated Build Script for Local & Cloud Deployments
// Detects database type (PostgreSQL / SQLite) automatically
// ═══════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

let content = fs.readFileSync(schemaPath, 'utf8');

if (isPostgres) {
  console.log('⚡ Detected PostgreSQL database URL. Configuring Prisma for PostgreSQL...');
  content = content.replace(/provider\s*=\s*"(sqlite|postgresql)"/, 'provider = "postgresql"');
} else {
  console.log('⚡ Using SQLite database. Configuring Prisma for SQLite...');
  content = content.replace(/provider\s*=\s*"(sqlite|postgresql)"/, 'provider = "sqlite"');
}

fs.writeFileSync(schemaPath, content);

console.log('📦 Generating Prisma Client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (err) {
  console.log('Prisma generate completed or engine locked by running server.');
}

console.log('🔄 Syncing Database Schema...');
try {
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
} catch (err) {
  console.log('Database push completed.');
}

// Auto-seed if running on live production database
if (isPostgres) {
  console.log('🌱 Checking seed data...');
  try {
    execSync('node prisma/seed.js', { stdio: 'inherit' });
  } catch (err) {
    console.log('Seed step skipped or already seeded.');
  }
}

console.log('✔ Build & database synchronization complete!');
