// ═══════════════════════════════════════════════════════════
// Document Sequence Generator
// Generates sequential numbers: PREFIX-YYYY-XXXX (e.g. QUO-2026-0001)
// ═══════════════════════════════════════════════════════════

import { prisma } from '../config/db.js';

export async function getNextDocumentNumber(type, db = prisma) {
  const currentYear = new Date().getFullYear();

  // Fetch settings for custom prefix
  const settings = await db.ownerSettings.findFirst();
  let prefix = 'DOC';

  if (type === 'QUOTATION') prefix = settings?.quotationPrefix || 'QUO';
  else if (type === 'AGREEMENT') prefix = settings?.agreementPrefix || 'AGR';
  else if (type === 'INVOICE') prefix = settings?.invoicePrefix || 'INV';
  else if (type === 'RECEIPT') prefix = settings?.receiptPrefix || 'REC';
  else if (type === 'HANDOVER') prefix = settings?.handoverPrefix || 'HDO';

  let candidateNumber;
  let isUnique = false;

  while (!isUnique) {
    const sequence = await db.documentSequence.upsert({
      where: {
        type_year: {
          type,
          year: currentYear,
        },
      },
      update: {
        lastNumber: {
          increment: 1,
        },
      },
      create: {
        type,
        year: currentYear,
        lastNumber: 1,
      },
    });

    const formattedNumber = String(sequence.lastNumber).padStart(4, '0');
    candidateNumber = `${prefix}-${currentYear}-${formattedNumber}`;

    const exists = await db.document.findUnique({
      where: { documentNumber: candidateNumber },
    });

    if (!exists) {
      isUnique = true;
    }
  }

  return candidateNumber;
}

