// ═══════════════════════════════════════════════════════════
// Owner Settings Routes — /api/v1/settings
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../config/db.js';
import { logActivity } from '../utils/activity.js';

export const settingsRouter = Router();

// ── GET / — Retrieve owner settings ───────────────────────
settingsRouter.get('/', async (req, res, next) => {
  try {
    let settings = await prisma.ownerSettings.findFirst({
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // If no settings exist yet, create defaults linked to current user
    if (!settings && req.session?.userId) {
      settings = await prisma.ownerSettings.create({
        data: {
          userId: req.session.userId,
          businessName: 'Vishal Prasad Web Development',
          email: 'vishalprasad7505@gmail.com',
          phone: '+91 8840243415',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          quotationPrefix: 'QUO',
          agreementPrefix: 'AGR',
          invoicePrefix: 'INV',
          receiptPrefix: 'REC',
          handoverPrefix: 'HDO',
          defaultValidityDays: 15,
          defaultPaymentTerms: '50% advance upon contract signing, 50% upon final project delivery & handover.',
          defaultRevisionTerms: 'Includes up to 2 rounds of design revisions. Additional revisions billed at standard hourly rate.',
          pdfFooterText: 'Thank you for your business! For inquiries, contact vishalprasad7505@gmail.com',
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });
    }

    res.json(settings || {});
  } catch (err) {
    next(err);
  }
});

// ── PUT / — Update owner settings ─────────────────────────
settingsRouter.put('/', async (req, res, next) => {
  try {
    const {
      businessName,
      email,
      phone,
      address,
      portfolioUrl,
      logoUrl,
      currency,
      timezone,
      paymentInstructions,
      taxEnabled,
      taxLabel,
      taxRate,
      taxRegistrationNumber,
      taxNote,
      quotationPrefix,
      agreementPrefix,
      invoicePrefix,
      receiptPrefix,
      handoverPrefix,
      defaultValidityDays,
      defaultPaymentTerms,
      defaultRevisionTerms,
      pdfFooterText,
    } = req.body;

    let existing = await prisma.ownerSettings.findFirst();

    let settings;
    if (existing) {
      settings = await prisma.ownerSettings.update({
        where: { id: existing.id },
        data: {
          businessName: businessName !== undefined ? businessName : existing.businessName,
          email: email !== undefined ? email : existing.email,
          phone: phone !== undefined ? phone : existing.phone,
          address: address !== undefined ? address : existing.address,
          portfolioUrl: portfolioUrl !== undefined ? portfolioUrl : existing.portfolioUrl,
          logoUrl: logoUrl !== undefined ? logoUrl : existing.logoUrl,
          currency: currency !== undefined ? currency : existing.currency,
          timezone: timezone !== undefined ? timezone : existing.timezone,
          paymentInstructions: paymentInstructions !== undefined ? paymentInstructions : existing.paymentInstructions,
          taxEnabled: taxEnabled !== undefined ? Boolean(taxEnabled) : existing.taxEnabled,
          taxLabel: taxLabel !== undefined ? taxLabel : existing.taxLabel,
          taxRate: taxRate !== undefined ? (taxRate ? Number(taxRate) : null) : existing.taxRate,
          taxRegistrationNumber: taxRegistrationNumber !== undefined ? taxRegistrationNumber : existing.taxRegistrationNumber,
          taxNote: taxNote !== undefined ? taxNote : existing.taxNote,
          quotationPrefix: quotationPrefix !== undefined ? quotationPrefix : existing.quotationPrefix,
          agreementPrefix: agreementPrefix !== undefined ? agreementPrefix : existing.agreementPrefix,
          invoicePrefix: invoicePrefix !== undefined ? invoicePrefix : existing.invoicePrefix,
          receiptPrefix: receiptPrefix !== undefined ? receiptPrefix : existing.receiptPrefix,
          handoverPrefix: handoverPrefix !== undefined ? handoverPrefix : existing.handoverPrefix,
          defaultValidityDays: defaultValidityDays !== undefined ? Number(defaultValidityDays) : existing.defaultValidityDays,
          defaultPaymentTerms: defaultPaymentTerms !== undefined ? defaultPaymentTerms : existing.defaultPaymentTerms,
          defaultRevisionTerms: defaultRevisionTerms !== undefined ? defaultRevisionTerms : existing.defaultRevisionTerms,
          pdfFooterText: pdfFooterText !== undefined ? pdfFooterText : existing.pdfFooterText,
        },
      });
    } else {
      settings = await prisma.ownerSettings.create({
        data: {
          userId: req.session.userId,
          businessName,
          email,
          phone,
          address,
          portfolioUrl,
          logoUrl,
          currency: currency || 'INR',
          timezone: timezone || 'Asia/Kolkata',
          paymentInstructions,
          taxEnabled: Boolean(taxEnabled),
          taxLabel: taxLabel || 'Tax',
          taxRate: taxRate ? Number(taxRate) : null,
          taxRegistrationNumber,
          taxNote,
          quotationPrefix: quotationPrefix || 'QUO',
          agreementPrefix: agreementPrefix || 'AGR',
          invoicePrefix: invoicePrefix || 'INV',
          receiptPrefix: receiptPrefix || 'REC',
          handoverPrefix: handoverPrefix || 'HDO',
          defaultValidityDays: Number(defaultValidityDays) || 15,
          defaultPaymentTerms,
          defaultRevisionTerms,
          pdfFooterText,
        },
      });
    }

    logActivity({
      userId: req.session?.userId,
      action: 'settings.updated',
      entityType: 'settings',
      entityId: settings.id,
      details: { businessName: settings.businessName, currency: settings.currency },
    });

    res.json(settings);
  } catch (err) {
    next(err);
  }
});
