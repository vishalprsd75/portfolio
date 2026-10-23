// ═══════════════════════════════════════════════════════════
// Dashboard Routes — /api/v1/dashboard
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../config/db.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', async (req, res, next) => {
  try {
    const [
      totalClients,
      activeProjects,
      allPayments,
      allInvoices,
      recentActivities,
      upcomingProjects,
    ] = await Promise.all([
      // Client counts
      prisma.client.count({ where: { status: 'ACTIVE' } }),

      // Active projects count
      prisma.project.count({
        where: {
          status: { in: ['APPROVED', 'IN_PROGRESS'] },
        },
      }),

      // All payments for total revenue calculation
      prisma.payment.findMany({
        select: { amount: true, paymentDate: true },
      }),

      // Invoices with status and balances
      prisma.invoice.findMany({
        where: {
          invoiceStatus: { not: 'CANCELLED' },
        },
        include: {
          document: {
            select: {
              id: true,
              documentNumber: true,
              totalAmount: true,
              dueDate: true,
              client: { select: { name: true } },
            },
          },
        },
      }),

      // Recent 10 activities
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),

      // Upcoming project deadlines
      prisma.project.findMany({
        where: {
          status: { in: ['IN_PROGRESS', 'APPROVED'] },
          deadline: { not: null },
        },
        take: 5,
        orderBy: { deadline: 'asc' },
        include: {
          client: { select: { name: true } },
        },
      }),
    ]);

    // Calculate Financial KPIs
    let totalRevenue = 0;
    allPayments.forEach((p) => {
      totalRevenue += Number(p.amount) || 0;
    });

    let outstandingReceivables = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    const now = new Date();

    allInvoices.forEach((inv) => {
      const balance = Number(inv.balance) || 0;
      outstandingReceivables += balance;

      if (balance > 0 && inv.document?.dueDate && new Date(inv.document.dueDate) < now) {
        overdueCount += 1;
        overdueAmount += balance;
      }
    });

    // Monthly revenue for the past 6 months
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      const monthNum = d.getMonth();

      const sum = allPayments.reduce((acc, p) => {
        const pd = new Date(p.paymentDate);
        if (pd.getFullYear() === year && pd.getMonth() === monthNum) {
          return acc + Number(p.amount);
        }
        return acc;
      }, 0);

      monthlyRevenue.push({
        month: `${monthKey} ${year}`,
        amount: Number(sum.toFixed(2)),
      });
    }

    res.json({
      kpis: {
        totalRevenue: totalRevenue.toFixed(2),
        outstandingReceivables: outstandingReceivables.toFixed(2),
        activeProjects,
        totalClients,
        overdueCount,
        overdueAmount: overdueAmount.toFixed(2),
      },
      monthlyRevenue,
      recentActivities,
      upcomingProjects,
    });
  } catch (err) {
    next(err);
  }
});
