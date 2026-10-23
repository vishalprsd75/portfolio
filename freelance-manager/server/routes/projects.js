// ═══════════════════════════════════════════════════════════
// Projects Routes — /api/v1/projects
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../config/db.js';
import { logActivity } from '../utils/activity.js';
import { validateRequired, sanitizeString, parseDecimal } from '../utils/validation.js';

export const projectsRouter = Router();

const VALID_STATUSES = ['LEAD', 'QUOTATION_SENT', 'APPROVED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

// ── GET / — List projects ─────────────────────────────────
projectsRouter.get('/', async (req, res, next) => {
  try {
    const { search, status, clientId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }
    if (clientId) {
      where.clientId = clientId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          client: { select: { id: true, name: true, businessName: true } },
          _count: { select: { tasks: true, documents: true, payments: true } },
        },
      }),
      prisma.project.count({ where }),
    ]);

    res.json({ projects, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Get single project ─────────────────────────
projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        tasks: { orderBy: { sortOrder: 'asc' } },
        documents: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, documentNumber: true, type: true, status: true,
            title: true, totalAmount: true, issueDate: true, createdAt: true,
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create project ──────────────────────────────
projectsRouter.post('/', async (req, res, next) => {
  try {
    const { clientId, name, projectType, description, scope, startDate, deadline, agreedAmount, paymentTerms, status, notes } = req.body;

    const missing = validateRequired(['clientId', 'name'], req.body);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const project = await prisma.project.create({
      data: {
        clientId,
        name: sanitizeString(name),
        projectType: sanitizeString(projectType) || null,
        description: sanitizeString(description) || null,
        scope: sanitizeString(scope) || null,
        startDate: startDate ? new Date(startDate) : null,
        deadline: deadline ? new Date(deadline) : null,
        agreedAmount: parseDecimal(agreedAmount),
        paymentTerms: sanitizeString(paymentTerms) || null,
        status: (status && VALID_STATUSES.includes(status)) ? status : 'LEAD',
        notes: sanitizeString(notes) || null,
      },
      include: {
        client: { select: { id: true, name: true, businessName: true } },
      },
    });

    await logActivity(req, 'project.created', 'project', project.id, { name: project.name });

    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

// ── PUT /:id — Update project ─────────────────────────────
projectsRouter.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { name, projectType, description, scope, startDate, deadline, agreedAmount, paymentTerms, status, notes } = req.body;

    // Prevent auto-approval: status changes must be explicit
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: sanitizeString(name) }),
        ...(projectType !== undefined && { projectType: sanitizeString(projectType) || null }),
        ...(description !== undefined && { description: sanitizeString(description) || null }),
        ...(scope !== undefined && { scope: sanitizeString(scope) || null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        ...(agreedAmount !== undefined && { agreedAmount: parseDecimal(agreedAmount) }),
        ...(paymentTerms !== undefined && { paymentTerms: sanitizeString(paymentTerms) || null }),
        ...(status && { status }),
        ...(notes !== undefined && { notes: sanitizeString(notes) || null }),
      },
      include: {
        client: { select: { id: true, name: true, businessName: true } },
      },
    });

    await logActivity(req, 'project.updated', 'project', project.id, { status: project.status });

    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/tasks — Add task to project ─────────────────
projectsRouter.post('/:id/tasks', async (req, res, next) => {
  try {
    const { title, description, dueDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    // Get next sort order
    const lastTask = await prisma.projectTask.findFirst({
      where: { projectId: req.params.id },
      orderBy: { sortOrder: 'desc' },
    });

    const task = await prisma.projectTask.create({
      data: {
        projectId: req.params.id,
        title: sanitizeString(title),
        description: sanitizeString(description) || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: (lastTask?.sortOrder || 0) + 1,
      },
    });

    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:id/tasks/:taskId — Toggle task completion ─────
projectsRouter.patch('/:id/tasks/:taskId', async (req, res, next) => {
  try {
    const { completed, title, description, dueDate } = req.body;

    const task = await prisma.projectTask.update({
      where: { id: req.params.taskId },
      data: {
        ...(completed !== undefined && { completed }),
        ...(title && { title: sanitizeString(title) }),
        ...(description !== undefined && { description: sanitizeString(description) || null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
    });

    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id/tasks/:taskId — Delete task ───────────────
projectsRouter.delete('/:id/tasks/:taskId', async (req, res, next) => {
  try {
    await prisma.projectTask.delete({ where: { id: req.params.taskId } });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id — Delete project ──────────────────────────
projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { documents: true, payments: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (existing._count.documents > 0 || existing._count.payments > 0) {
      return res.status(400).json({ error: 'Cannot delete project with active documents or payments.' });
    }
    await prisma.$transaction(async (tx) => {
      await tx.projectTask.deleteMany({ where: { projectId: req.params.id } });
      await tx.project.delete({ where: { id: req.params.id } });
    });
    await logActivity(req, 'project.deleted', 'project', req.params.id, { name: existing.name });
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
});

