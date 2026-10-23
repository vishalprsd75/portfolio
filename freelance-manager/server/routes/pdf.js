// ═══════════════════════════════════════════════════════════
// PDF Routes — /api/v1/pdf
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { prisma } from '../config/db.js';
import { generateDocumentHTML } from '../services/pdfGenerator.js';

export const pdfRouter = Router();

// ── GET /:id/html — Raw HTML Preview for Browser / Print ───
pdfRouter.get('/:id/html', async (req, res, next) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        project: true,
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!document) {
      return res.status(404).send('Document not found');
    }

    const settings = await prisma.ownerSettings.findFirst();
    const html = generateDocumentHTML(document, settings);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// ── GET /:id/download — Render & Stream PDF ────────────────
pdfRouter.get('/:id/download', async (req, res, next) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        project: true,
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const settings = await prisma.ownerSettings.findFirst();
    const html = generateDocumentHTML(document, settings);

    // Try Puppeteer PDF generation if available
    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      });

      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.documentNumber}.pdf"`
      );
      return res.send(pdfBuffer);
    } catch (puppeteerErr) {
      console.warn('Puppeteer PDF export failed, serving printable HTML fallback:', puppeteerErr.message);
      // Fallback: send HTML with auto-print script
      const printHtml = html.replace('</body>', '<script>window.onload=()=>{window.print();}</script></body>');
      res.setHeader('Content-Type', 'text/html');
      return res.send(printHtml);
    }
  } catch (err) {
    next(err);
  }
});
