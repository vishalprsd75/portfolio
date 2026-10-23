// ═══════════════════════════════════════════════════════════
// Payments Routes — /api/v1/payments
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../config/db.js';
import { logActivity } from '../utils/activity.js';
import { getNextDocumentNumber } from '../utils/sequence.js';

export const paymentsRouter = Router();

// ── GET / — List payments ─────────────────────────────────
paymentsRouter.get('/', async (req, res, next) => {
  try {
    const {
      clientId,
      projectId,
      page = 1,
      limit = 20,
      sortBy = 'paymentDate',
      order = 'desc',
    } = req.query;

    const where = {};
    if (clientId) where.clientId = clientId;
    if (projectId) where.projectId = projectId;

    const take = Math.min(Number(limit) || 20, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        take,
        skip,
        orderBy: { [sortBy]: order === 'asc' ? 'asc' : 'desc' },
        include: {
          client: {
            select: { id: true, name: true, businessName: true, email: true },
          },
          project: {
            select: { id: true, name: true },
          },
          allocations: {
            include: {
              invoice: {
                include: {
                  document: {
                    select: { id: true, documentNumber: true, totalAmount: true },
                  },
                },
              },
            },
          },
          receipts: {
            select: { id: true, documentNumber: true, totalAmount: true, status: true },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      data: payments,
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

// ── GET /:id — Payment details ────────────────────────────
paymentsRouter.get('/:id', async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        project: true,
        allocations: {
          include: {
            invoice: {
              include: {
                document: true,
              },
            },
          },
        },
        receipts: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Record new payment ───────────────────────────
paymentsRouter.post('/', async (req, res, next) => {
  try {
    const {
      clientId,
      projectId,
      amount,
      paymentDate,
      paymentMethod,
      transactionRef,
      notes,
      allocations = [], // [{ invoiceId, amount }]
      autoGenerateReceipt = false,
    } = req.body;

    const numAmount = Number(amount);
    if (!clientId || !numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Client ID and valid positive amount are required' });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(400).json({ error: 'Client does not exist' });
    }

    let receiptNumber = null;
    if (autoGenerateReceipt) {
      receiptNumber = await getNextDocumentNumber('RECEIPT');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create payment
      const payment = await tx.payment.create({
        data: {
          clientId,
          projectId: projectId || null,
          amount: numAmount.toFixed(2),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod: paymentMethod || 'Bank Transfer',
          transactionRef: transactionRef || null,
          notes: notes || null,
        },
      });

      // 2. Handle allocations & update invoices
      let primaryInvoiceDoc = null;
      for (const alloc of allocations) {
        const allocAmount = Number(alloc.amount) || 0;
        if (allocAmount <= 0 || !alloc.invoiceId) continue;

        // Fetch invoice
        const inv = await tx.invoice.findUnique({
          where: { id: alloc.invoiceId },
          include: { document: true },
        });

        if (!inv) continue;
        if (!primaryInvoiceDoc) primaryInvoiceDoc = inv.document;

        // Create allocation record
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: inv.id,
            amount: allocAmount.toFixed(2),
          },
        });

        // Recalculate invoice balance and status
        const newPaid = Number(inv.paidAmount) + allocAmount;
        const total = Number(inv.document.totalAmount);
        const newBalance = Math.max(0, total - newPaid);
        const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: newPaid.toFixed(2),
            balance: newBalance.toFixed(2),
            invoiceStatus: newStatus,
          },
        });
      }

      // 3. Auto-generate receipt if requested
      let receipt = null;
      if (autoGenerateReceipt && receiptNumber) {
        receipt = await tx.document.create({
          data: {
            documentNumber: receiptNumber,
            type: 'RECEIPT',
            status: 'ISSUED',
            clientId,
            projectId: projectId || null,
            issueDate: payment.paymentDate,
            title: `Payment Receipt for ${client.name}`,
            subtotal: numAmount.toFixed(2),
            totalAmount: numAmount.toFixed(2),
            paymentId: payment.id,
            notes: `Payment received via ${paymentMethod || 'Bank Transfer'}${transactionRef ? ` (Ref: ${transactionRef})` : ''}`,
            lineItems: {
              create: [
                {
                  description: primaryInvoiceDoc
                    ? `Payment received against Invoice ${primaryInvoiceDoc.documentNumber}`
                    : `Payment received - ${client.name}`,
                  quantity: 1,
                  unitPrice: numAmount.toFixed(2),
                  amount: numAmount.toFixed(2),
                  sortOrder: 0,
                },
              ],
            },
          },
        });

        // Link document relationship if primary invoice exists
        if (primaryInvoiceDoc) {
          await tx.documentRelationship.create({
            data: {
              fromDocId: primaryInvoiceDoc.id,
              toDocId: receipt.id,
              relationType: 'invoice_to_receipt',
            },
          });
        }
      }

      return { payment, receipt };
    });

    logActivity({
      userId: req.session?.userId,
      action: 'payment.recorded',
      entityType: 'payment',
      entityId: result.payment.id,
      details: { amount: result.payment.amount, client: client.name },
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id — Delete payment & reverse allocations ────
paymentsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        allocations: {
          include: { invoice: { include: { document: true } } },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await prisma.$transaction(async (tx) => {
      // Revert allocations on invoices
      for (const alloc of payment.allocations) {
        const inv = alloc.invoice;
        const allocAmount = Number(alloc.amount);
        const newPaid = Math.max(0, Number(inv.paidAmount) - allocAmount);
        const total = Number(inv.document.totalAmount);
        const newBalance = Math.max(0, total - newPaid);

        let newStatus = inv.invoiceStatus;
        if (newPaid === 0) {
          newStatus = inv.document.status === 'ISSUED' ? 'ISSUED' : 'DRAFT';
        } else if (newBalance > 0) {
          newStatus = 'PARTIALLY_PAID';
        }

        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: newPaid.toFixed(2),
            balance: newBalance.toFixed(2),
            invoiceStatus: newStatus,
          },
        });
      }

      // Delete payment (cascade deletes allocations)
      await tx.payment.delete({ where: { id } });
    });

    logActivity({
      userId: req.session?.userId,
      action: 'payment.deleted',
      entityType: 'payment',
      entityId: id,
      details: { amount: payment.amount },
    });

    res.json({ message: 'Payment deleted and allocations reversed successfully' });
  } catch (err) {
    next(err);
  }
});
