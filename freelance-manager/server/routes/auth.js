// ═══════════════════════════════════════════════════════════
// Auth Routes — /api/v1/auth
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db.js';
import { logActivity } from '../utils/activity.js';
import { validateEmail, validateRequired } from '../utils/validation.js';

export const authRouter = Router();

// ── POST /login ───────────────────────────────────────────
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      // Consistent timing to prevent user enumeration
      await bcrypt.hash('dummy', 10);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      await logActivity(req, 'auth.login_failed', 'user', user.id, { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;

    await logActivity(req, 'auth.login', 'user', user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /logout ──────────────────────────────────────────
authRouter.post('/logout', (req, res) => {
  const userId = req.session?.userId;
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('fm.sid');
    res.json({ message: 'Logged out' });
  });
});

// ── GET /me ───────────────────────────────────────────────
authRouter.get('/me', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /setup (First-time owner account creation) ───────
authRouter.post('/setup', async (req, res, next) => {
  try {
    // Only allow if no users exist
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(403).json({ error: 'Setup already completed' });
    }

    const { name, email, password } = req.body;

    const missing = validateRequired(['name', 'email', 'password'], req.body);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: 'owner',
        settings: {
          create: {
            businessName: name.trim(),
            email: email.trim().toLowerCase(),
          },
        },
      },
    });

    // Auto-login after setup
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;

    await logActivity(req, 'auth.setup', 'user', user.id);

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /setup-status ─────────────────────────────────────
authRouter.get('/setup-status', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ setupComplete: userCount > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
