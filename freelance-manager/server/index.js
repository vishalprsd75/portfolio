// ═══════════════════════════════════════════════════════════
// Server Entry — Freelance Business Management System
// ═══════════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync, mkdirSync } from 'fs';

import { prisma } from './config/db.js';
import { authRouter } from './routes/auth.js';
import { clientsRouter } from './routes/clients.js';
import { projectsRouter } from './routes/projects.js';
import { documentsRouter } from './routes/documents.js';
import { paymentsRouter } from './routes/payments.js';
import { settingsRouter } from './routes/settings.js';
import { dashboardRouter } from './routes/dashboard.js';
import { pdfRouter } from './routes/pdf.js';
import { requireAuth } from './middleware/auth.js';

import connectPgSimple from 'connect-pg-simple';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3500;
const isProduction = process.env.NODE_ENV === 'production';
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

const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

// Trust reverse proxy (Vercel, Render, Cloudflare, NGINX)
app.set('trust proxy', 1);

// ── Storage directory for PDFs ────────────────────────────
const storagePath = join(__dirname, '..', 'storage', 'pdfs');
try {
  if (!existsSync(storagePath)) {
    mkdirSync(storagePath, { recursive: true });
  }
} catch (e) {
  // Serverless runtimes (like Vercel) have a read-only root filesystem
}

// ── Security Headers ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: isProduction ? (process.env.APP_URL || true) : 'http://localhost:3500',
  credentials: true,
}));

// ── Body Parsing ──────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Session Store (Postgres in cloud / MemoryStore in local dev) ────
let sessionStore;
if (isPostgres) {
  try {
    const PgStore = connectPgSimple(session);
    sessionStore = new PgStore({
      conString: dbUrl,
      createTableIfMissing: true,
      tableName: 'session',
    });
  } catch (err) {
    console.warn('⚠️ Could not initialize connect-pg-simple store, using fallback:', err.message);
  }
}

// ── Session ───────────────────────────────────────────────
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'fm.sid',
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ── Rate Limiting ─────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 15 : 1000,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isProduction ? 120 : 1000,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── API Routes ────────────────────────────────────────────
app.use('/api/v1/auth', apiLimiter, authRouter);
app.use('/api/v1/dashboard', apiLimiter, requireAuth, dashboardRouter);
app.use('/api/v1/clients', apiLimiter, requireAuth, clientsRouter);
app.use('/api/v1/projects', apiLimiter, requireAuth, projectsRouter);
app.use('/api/v1/documents', apiLimiter, requireAuth, documentsRouter);
app.use('/api/v1/payments', apiLimiter, requireAuth, paymentsRouter);
app.use('/api/v1/settings', apiLimiter, requireAuth, settingsRouter);
app.use('/api/v1/pdf', apiLimiter, requireAuth, pdfRouter);

// ── Static Files (Client SPA) ─────────────────────────────
app.use(express.static(join(__dirname, '..', 'client'), {
  maxAge: isProduction ? '1d' : 0,
}));

// ── SPA Fallback ──────────────────────────────────────────
app.get('*', (req, res) => {
  // Don't serve SPA for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(join(__dirname, '..', 'client', 'index.html'));
});

// ── Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (!isProduction) console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(statusCode).json({ error: message });
});

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ⚡ Freelance Manager running at port ${PORT}\n`);
});

// ── Graceful Shutdown ─────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
