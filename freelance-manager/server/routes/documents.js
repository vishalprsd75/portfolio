// ═══════════════════════════════════════════════════════════
// Documents Routes — /api/v1/documents
// Supports: Quotations, Agreements, Invoices, Receipts, Handovers
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../config/db.js';
import { logActivity } from '../utils/activity.js';
import { getNextDocumentNumber } from '../utils/sequence.js';
import { Prisma } from '@prisma/client';

export const documentsRouter = Router();

// ── Calculate Document Totals ──────────────────────────────
function calculateTotals(lineItems = [], discountPercent = 0, taxPercent = 0) {
  let subtotal = 0;
  for (const item of lineItems) {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    subtotal += qty * price;
  }

  const dPct = Number(discountPercent) || 0;
  const discountAmount = dPct > 0 ? (subtotal * dPct) / 100 : 0;
  const subtotalAfterDiscount = subtotal - discountAmount;

  const tPct = Number(taxPercent) || 0;
  const taxAmount = tPct > 0 ? (subtotalAfterDiscount * tPct) / 100 : 0;
  const totalAmount = subtotalAfterDiscount + taxAmount;

  return {
    subtotal: subtotal.toFixed(2),
    discountPercent: dPct,
    discountAmount: discountAmount.toFixed(2),
    taxPercent: tPct,
    taxAmount: taxAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  };
}

// ── GET / — List documents with filters & pagination ───────
documentsRouter.get('/', async (req, res, next) => {
  try {
    const {
      type,
      status,
      clientId,
      projectId,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const where = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (projectId) where.projectId = projectId;

    if (search) {
      where.OR = [
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { businessName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const take = Math.min(Number(limit) || 20, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where,
        take,
        skip,
        orderBy: { [sortBy]: order === 'asc' ? 'asc' : 'desc' },
        include: {
          client: {
            select: { id: true, name: true, businessName: true, email: true },
          },
          project: {
            select: { id: true, name: true, status: true },
          },
          invoice: true,
          _count: {
            select: { lineItems: true, versions: true },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    res.json({
      data: documents,
      pagination: {
        page: Number(page) || 1,
        limit: take,
        total: totalCount,
        totalPages: Math.ceil(totalCount / take),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Document details with line items and relations ─
documentsRouter.get('/:id', async (req, res, next) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        project: true,
        lineItems: {
          orderBy: { sortOrder: 'asc' },
        },
        invoice: {
          include: {
            allocations: {
              include: {
                payment: true,
              },
            },
          },
        },
        payment: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        relatedFromDocs: {
          include: { toDoc: true },
        },
        relatedToDocs: {
          include: { fromDoc: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create new document ──────────────────────────
documentsRouter.post('/', async (req, res, next) => {
  try {
    const {
      type,
      status = 'DRAFT',
      clientId,
      projectId,
      issueDate,
      validityDate,
      dueDate,
      title,
      description,
      notes,
      terms,
      clauses,
      discountPercent,
      taxPercent,
      completionDate,
      deliverables,
      websiteUrl,
      transferChecklist,
      supportPeriod,
      paymentId,
      lineItems = [],
      sourceDocId,
      relationType,
    } = req.body;

    if (!type || !clientId) {
      return res.status(400).json({ error: 'Document type and client are required' });
    }

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(400).json({ error: 'Client does not exist' });
    }

    // Generate auto-sequential document number
    const documentNumber = await getNextDocumentNumber(type);

    // Calculate financials
    const totals = calculateTotals(lineItems, discountPercent, taxPercent);

    // Transaction to create document, line items, and invoice if applicable
    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          documentNumber,
          type,
          status,
          clientId,
          projectId: projectId || null,
          issueDate: issueDate ? new Date(issueDate) : new Date(),
          validityDate: validityDate ? new Date(validityDate) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          title: title || `${type} for ${client.name}`,
          description,
          notes,
          terms,
          clauses: clauses || null,
          subtotal: totals.subtotal,
          discountPercent: totals.discountPercent,
          discountAmount: totals.discountAmount,
          taxPercent: totals.taxPercent,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          completionDate: completionDate ? new Date(completionDate) : null,
          deliverables: deliverables || null,
          websiteUrl,
          transferChecklist: transferChecklist || null,
          supportPeriod,
          paymentId: paymentId || null,
          lineItems: {
            create: lineItems.map((item, index) => ({
              description: item.description,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              amount: (Number(item.quantity || 1) * Number(item.unitPrice || 0)).toFixed(2),
              sortOrder: index,
            })),
          },
        },
        include: {
          client: true,
          project: true,
          lineItems: true,
        },
      });

      // If document is INVOICE, create child Invoice record
      if (type === 'INVOICE') {
        await tx.invoice.create({
          data: {
            documentId: doc.id,
            invoiceStatus: status === 'ISSUED' ? 'ISSUED' : 'DRAFT',
            paidAmount: 0,
            balance: totals.totalAmount,
          },
        });
      }

      // If created as ISSUED, create initial snapshot version
      if (status === 'ISSUED') {
        await tx.documentVersion.create({
          data: {
            documentId: doc.id,
            versionNumber: 1,
            snapshot: doc,
          },
        });
      }

      // If converted from another document, link relation
      if (sourceDocId && relationType) {
        await tx.documentRelationship.create({
          data: {
            fromDocId: sourceDocId,
            toDocId: doc.id,
            relationType,
          },
        });
      }

      return doc;
    });

    logActivity({
      userId: req.session?.userId,
      action: 'document.created',
      entityType: 'document',
      entityId: result.id,
      details: { documentNumber: result.documentNumber, type: result.type, total: result.totalAmount },
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ── PUT /:id — Update document ────────────────────────────
documentsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.document.findUnique({
      where: { id },
      include: { lineItems: true, invoice: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const {
      status,
      projectId,
      issueDate,
      validityDate,
      dueDate,
      title,
      description,
      notes,
      terms,
      clauses,
      discountPercent,
      taxPercent,
      completionDate,
      deliverables,
      websiteUrl,
      transferChecklist,
      supportPeriod,
      lineItems,
    } = req.body;

    const itemsToCalculate = lineItems !== undefined ? lineItems : existing.lineItems;
    const dp = discountPercent !== undefined ? discountPercent : existing.discountPercent;
    const tp = taxPercent !== undefined ? taxPercent : existing.taxPercent;
    const totals = calculateTotals(itemsToCalculate, dp, tp);

    const result = await prisma.$transaction(async (tx) => {
      // If line items are provided, replace them
      if (lineItems !== undefined) {
        await tx.documentLineItem.deleteMany({ where: { documentId: id } });
        if (lineItems.length > 0) {
          await tx.documentLineItem.createMany({
            data: lineItems.map((item, index) => ({
              documentId: id,
              description: item.description,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              amount: (Number(item.quantity || 1) * Number(item.unitPrice || 0)).toFixed(2),
              sortOrder: index,
            })),
          });
        }
      }

      const updatedDoc = await tx.document.update({
        where: { id },
        data: {
          status: status || existing.status,
          projectId: projectId !== undefined ? (projectId || null) : existing.projectId,
          issueDate: issueDate ? new Date(issueDate) : existing.issueDate,
          validityDate: validityDate ? new Date(validityDate) : existing.validityDate,
          dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
          title: title !== undefined ? title : existing.title,
          description: description !== undefined ? description : existing.description,
          notes: notes !== undefined ? notes : existing.notes,
          terms: terms !== undefined ? terms : existing.terms,
          clauses: clauses !== undefined ? clauses : existing.clauses,
          subtotal: totals.subtotal,
          discountPercent: totals.discountPercent,
          discountAmount: totals.discountAmount,
          taxPercent: totals.taxPercent,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          completionDate: completionDate ? new Date(completionDate) : existing.completionDate,
          deliverables: deliverables !== undefined ? deliverables : existing.deliverables,
          websiteUrl: websiteUrl !== undefined ? websiteUrl : existing.websiteUrl,
          transferChecklist: transferChecklist !== undefined ? transferChecklist : existing.transferChecklist,
          supportPeriod: supportPeriod !== undefined ? supportPeriod : existing.supportPeriod,
        },
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
          client: true,
          project: true,
          invoice: true,
        },
      });

      // If document has an Invoice, recalculate balance
      if (existing.invoice) {
        const paid = Number(existing.invoice.paidAmount) || 0;
        const newTotal = Number(totals.totalAmount);
        const newBalance = Math.max(0, newTotal - paid);
        let newInvStatus = existing.invoice.invoiceStatus;
        if (newBalance <= 0 && paid > 0) newInvStatus = 'PAID';
        else if (paid > 0) newInvStatus = 'PARTIALLY_PAID';
        else if (status === 'ISSUED') newInvStatus = 'ISSUED';

        await tx.invoice.update({
          where: { id: existing.invoice.id },
          data: {
            balance: newBalance.toFixed(2),
            invoiceStatus: newInvStatus,
          },
        });
      }

      // If status changed to ISSUED, create version snapshot
      if (status === 'ISSUED' && existing.status !== 'ISSUED') {
        const versionCount = await tx.documentVersion.count({ where: { documentId: id } });
        await tx.documentVersion.create({
          data: {
            documentId: id,
            versionNumber: versionCount + 1,
            snapshot: updatedDoc,
          },
        });
      }

      return updatedDoc;
    });

    logActivity({
      userId: req.session?.userId,
      action: 'document.updated',
      entityType: 'document',
      entityId: result.id,
      details: { documentNumber: result.documentNumber, status: result.status },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:id/status — Quick status change ───────────────
documentsRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedDoc = await tx.document.update({
        where: { id },
        data: { status },
        include: { lineItems: true, client: true, project: true },
      });

      if (doc.invoice) {
        let invStatus = doc.invoice.invoiceStatus;
        if (status === 'CANCELLED') invStatus = 'CANCELLED';
        else if (status === 'ISSUED' && invStatus === 'DRAFT') invStatus = 'ISSUED';

        await tx.invoice.update({
          where: { id: doc.invoice.id },
          data: { invoiceStatus: invStatus },
        });
      }

      if (status === 'ISSUED') {
        const versionCount = await tx.documentVersion.count({ where: { documentId: id } });
        await tx.documentVersion.create({
          data: {
            documentId: id,
            versionNumber: versionCount + 1,
            snapshot: updatedDoc,
          },
        });
      }

      return updatedDoc;
    });

    logActivity({
      userId: req.session?.userId,
      action: 'document.status_changed',
      entityType: 'document',
      entityId: id,
      details: { from: doc.status, to: status },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id — Delete document ─────────────────────────
documentsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { invoice: { include: { allocations: true } } },
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Protect invoices with recorded payment allocations
    if (doc.invoice?.allocations?.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete invoice with recorded payments. Please unallocate or delete payments first.',
      });
    }

    await prisma.document.delete({ where: { id } });

    logActivity({
      userId: req.session?.userId,
      action: 'document.deleted',
      entityType: 'document',
      entityId: id,
      details: { documentNumber: doc.documentNumber, type: doc.type },
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    next(err);
  }
});
