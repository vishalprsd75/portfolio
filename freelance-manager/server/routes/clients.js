// ═══════════════════════════════════════════════════════════
// Clients Routes — /api/v1/clients
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../config/db.js';
import { logActivity } from '../utils/activity.js';
import { validateEmail, validateRequired, sanitizeString } from '../utils/validation.js';

export const clientsRouter = Router();

// ── GET / — List clients ──────────────────────────────────
clientsRouter.get('/', async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (status && ['ACTIVE', 'ARCHIVED'].includes(status)) {
      where.status = status;
    } else {
      where.status = 'ACTIVE'; // Default to active
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { businessName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          _count: {
            select: { projects: true, documents: true, payments: true },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({ clients, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Get single client ──────────────────────────
clientsRouter.get('/:id', async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        projects: { orderBy: { createdAt: 'desc' } },
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true, documentNumber: true, type: true, status: true,
            title: true, totalAmount: true, issueDate: true, createdAt: true,
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 20,
        },
        _count: {
          select: { projects: true, documents: true, payments: true },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ client });
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create client ────────────────────────────────
clientsRouter.post('/', async (req, res, next) => {
  try {
    const { name, businessName, email, phone, address, notes } = req.body;

    const missing = validateRequired(['name', 'email'], req.body);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Duplicate check
    const existing = await prisma.client.findFirst({
      where: { email: email.trim().toLowerCase(), status: 'ACTIVE' },
    });

    if (existing) {
      return res.status(409).json({
        error: 'A client with this email already exists',
        existingClient: { id: existing.id, name: existing.name, email: existing.email },
      });
    }

    const client = await prisma.client.create({
      data: {
        name: sanitizeString(name),
        businessName: sanitizeString(businessName) || null,
        email: email.trim().toLowerCase(),
        phone: sanitizeString(phone) || null,
        address: sanitizeString(address) || null,
        notes: sanitizeString(notes) || null,
      },
    });

    await logActivity(req, 'client.created', 'client', client.id, { name: client.name });

    res.status(201).json({ client });
  } catch (err) {
    next(err);
  }
});

// ── PUT /:id — Update client ──────────────────────────────
clientsRouter.put('/:id', async (req, res, next) => {
  try {
    const { name, businessName, email, phone, address, notes, status } = req.body;

    const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Duplicate email check (exclude self)
    if (email && email.trim().toLowerCase() !== existing.email) {
      const duplicate = await prisma.client.findFirst({
        where: {
          email: email.trim().toLowerCase(),
          status: 'ACTIVE',
          NOT: { id: req.params.id },
        },
      });
      if (duplicate) {
        return res.status(409).json({
          error: 'Another client with this email already exists',
          existingClient: { id: duplicate.id, name: duplicate.name },
        });
      }
    }

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: sanitizeString(name) }),
        ...(businessName !== undefined && { businessName: sanitizeString(businessName) || null }),
        ...(email && { email: email.trim().toLowerCase() }),
        ...(phone !== undefined && { phone: sanitizeString(phone) || null }),
        ...(address !== undefined && { address: sanitizeString(address) || null }),
        ...(notes !== undefined && { notes: sanitizeString(notes) || null }),
        ...(status && ['ACTIVE', 'ARCHIVED'].includes(status) && { status }),
      },
    });

    await logActivity(req, 'client.updated', 'client', client.id);

    res.json({ client });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:id/archive — Archive client ───────────────────
clientsRouter.patch('/:id/archive', async (req, res, next) => {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED' },
    });

    await logActivity(req, 'client.archived', 'client', client.id);

    res.json({ client });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:id/restore — Restore archived client ──────────
clientsRouter.patch('/:id/restore', async (req, res, next) => {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
    });

    await logActivity(req, 'client.restored', 'client', client.id);

    res.json({ client });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id — Delete client ───────────────────────────
clientsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { projects: true, documents: true, payments: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }
    if (existing._count.documents > 0 || existing._count.payments > 0) {
      return res.status(400).json({ error: 'Cannot delete client with active documents or payments. You can set their status to Archived.' });
    }
    await prisma.client.delete({ where: { id: req.params.id } });
    await logActivity(req, 'client.deleted', 'client', req.params.id, { name: existing.name });
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    next(err);
  }
});

