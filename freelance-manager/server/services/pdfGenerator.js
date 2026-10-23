// ═══════════════════════════════════════════════════════════
// PDF Generator Service — Premium Document Templates
// ═══════════════════════════════════════════════════════════

import { formatCurrency } from '../utils/currency.js';

export function generateDocumentHTML(document, settings) {
  const currency = settings?.currency || 'INR';
  const bizName = settings?.businessName || 'Vishal Prasad Web Development';
  const bizEmail = settings?.email || 'vishalprasad7505@gmail.com';
  const bizPhone = settings?.phone || '+91 8840243415';
  const bizAddress = settings?.address || 'India';
  const footerText = settings?.pdfFooterText || 'Thank you for your business!';
  const paymentInstructions = settings?.paymentInstructions || '';

  const issueDateFormatted = document.issueDate
    ? new Date(document.issueDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  const dueDateFormatted = document.dueDate
    ? new Date(document.dueDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const validityDateFormatted = document.validityDate
    ? new Date(document.validityDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  // Badge Color
  const typeBadgeText = document.type.replace('_', ' ');

  // Line items table rows
  const lineItemRows = (document.lineItems || []).map((item, idx) => `
    <tr>
      <td class="col-num">${idx + 1}</td>
      <td class="col-desc">
        <strong>${escapeHtml(item.description)}</strong>
      </td>
      <td class="col-qty">${Number(item.quantity)}</td>
      <td class="col-rate">${formatCurrency(item.unitPrice, currency)}</td>
      <td class="col-total">${formatCurrency(item.amount, currency)}</td>
    </tr>
  `).join('');

  // Agreement Clauses if type === 'AGREEMENT'
  let customSection = '';
  if (document.type === 'AGREEMENT' && document.clauses && Array.isArray(document.clauses)) {
    customSection = `
      <div class="section-title">Terms & Agreement Clauses</div>
      <div class="clauses-list">
        ${document.clauses.map((c, i) => `
          <div class="clause-item">
            <h4>${i + 1}. ${escapeHtml(c.title || 'Clause')}</h4>
            <p>${escapeHtml(c.content || '')}</p>
          </div>
        `).join('')}
      </div>
    `;
  } else if (document.type === 'HANDOVER') {
    customSection = `
      <div class="section-title">Project Handover & Deliverables</div>
      <div class="handover-details">
        ${document.websiteUrl ? `<p><strong>Live URL:</strong> <a href="${escapeHtml(document.websiteUrl)}" target="_blank">${escapeHtml(document.websiteUrl)}</a></p>` : ''}
        ${document.supportPeriod ? `<p><strong>Included Support:</strong> ${escapeHtml(document.supportPeriod)}</p>` : ''}
        ${document.deliverables && Array.isArray(document.deliverables) ? `
          <h4>Deliverables Handed Over:</h4>
          <ul>
            ${document.deliverables.map(d => `<li>${escapeHtml(typeof d === 'string' ? d : d.title)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(document.documentNumber)} — ${escapeHtml(document.title || document.type)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.5;
      font-size: 13px;
      -webkit-font-smoothing: antialiased;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 10px;
    }
    /* Header */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 24px;
    }
    .biz-brand h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }
    .biz-brand p {
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 12px;
      border-radius: 4px;
      background: #0f172a;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .doc-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .doc-date {
      font-size: 12px;
      color: #64748b;
    }
    /* Parties Section */
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 28px;
    }
    .party-card h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .party-card .party-name {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .party-card p {
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }
    /* Info Row (Dates & Status) */
    .info-bar {
      display: flex;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 28px;
      justify-content: space-between;
    }
    .info-bar-item {
      font-size: 12px;
    }
    .info-bar-item span {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .info-bar-item strong {
      color: #0f172a;
      font-weight: 600;
    }
    /* Line Items Table */
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    table.items-table th {
      background: #f1f5f9;
      color: #334155;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 2px solid #cbd5e1;
    }
    table.items-table td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12.5px;
      color: #334155;
      vertical-align: top;
    }
    .col-num { width: 35px; color: #94a3b8; }
    .col-qty { width: 60px; text-align: center; }
    .col-rate { width: 120px; text-align: right; }
    .col-total { width: 130px; text-align: right; font-weight: 600; color: #0f172a; }

    /* Summary & Totals */
    .totals-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .totals-card {
      width: 300px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 12.5px;
      color: #475569;
    }
    .totals-row.grand-total {
      border-top: 2px solid #0f172a;
      padding-top: 10px;
      margin-top: 6px;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .totals-row.grand-total span.amount {
      color: #0f766e;
    }

    /* Terms & Notes */
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #475569;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .notes-box {
      font-size: 11.5px;
      color: #64748b;
      margin-bottom: 24px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    /* Bank & Instructions */
    .payment-box {
      background: #f8fafc;
      border-left: 3px solid #0f766e;
      padding: 12px 16px;
      font-size: 11.5px;
      color: #334155;
      margin-bottom: 30px;
      border-radius: 0 6px 6px 0;
    }

    /* Signature Area */
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      padding-top: 20px;
    }
    .sign-card {
      width: 220px;
      text-align: center;
    }
    .sign-line {
      border-bottom: 1px solid #94a3b8;
      margin-bottom: 8px;
      height: 40px;
    }
    .sign-card p {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }

    /* Footer */
    .doc-footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="doc-header">
      <div class="biz-brand">
        <h1>${escapeHtml(bizName)}</h1>
        <p>${escapeHtml(bizEmail)} • ${escapeHtml(bizPhone)}</p>
        <p>${escapeHtml(bizAddress)}</p>
      </div>
      <div class="doc-meta">
        <div class="doc-badge">${typeBadgeText}</div>
        <div class="doc-num">${escapeHtml(document.documentNumber)}</div>
        <div class="doc-date">Date: ${issueDateFormatted}</div>
      </div>
    </div>

    <!-- Parties Grid -->
    <div class="parties-grid">
      <div class="party-card">
        <h3>Issued By</h3>
        <div class="party-name">${escapeHtml(bizName)}</div>
        <p>${escapeHtml(bizEmail)}</p>
        <p>${escapeHtml(bizPhone)}</p>
      </div>
      <div class="party-card">
        <h3>Prepared For</h3>
        <div class="party-name">${escapeHtml(document.client?.name || 'Valued Client')}</div>
        ${document.client?.businessName ? `<p><strong>${escapeHtml(document.client.businessName)}</strong></p>` : ''}
        ${document.client?.email ? `<p>${escapeHtml(document.client.email)}</p>` : ''}
        ${document.client?.phone ? `<p>${escapeHtml(document.client.phone)}</p>` : ''}
        ${document.client?.address ? `<p>${escapeHtml(document.client.address)}</p>` : ''}
      </div>
    </div>

    <!-- Dates / Info Bar -->
    <div class="info-bar">
      <div class="info-bar-item">
        <span>Document Status</span>
        <strong>${escapeHtml(document.status)}</strong>
      </div>
      ${validityDateFormatted ? `
        <div class="info-bar-item">
          <span>Valid Until</span>
          <strong>${validityDateFormatted}</strong>
        </div>
      ` : ''}
      ${dueDateFormatted ? `
        <div class="info-bar-item">
          <span>Payment Due</span>
          <strong>${dueDateFormatted}</strong>
        </div>
      ` : ''}
      ${document.project?.name ? `
        <div class="info-bar-item">
          <span>Project</span>
          <strong>${escapeHtml(document.project.name)}</strong>
        </div>
      ` : ''}
    </div>

    ${document.description ? `
      <div class="section-title">Overview & Scope</div>
      <div class="notes-box">${escapeHtml(document.description)}</div>
    ` : ''}

    <!-- Line Items Table -->
    ${(document.lineItems && document.lineItems.length > 0) ? `
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th class="col-desc">Item & Description</th>
            <th class="col-qty">Qty</th>
            <th class="col-rate">Unit Price</th>
            <th class="col-total">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemRows}
        </tbody>
      </table>

      <!-- Totals Section -->
      <div class="totals-wrapper">
        <div class="totals-card">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(document.subtotal, currency)}</span>
          </div>
          ${Number(document.discountAmount) > 0 ? `
            <div class="totals-row">
              <span>Discount (${Number(document.discountPercent)}%):</span>
              <span>-${formatCurrency(document.discountAmount, currency)}</span>
            </div>
          ` : ''}
          ${Number(document.taxAmount) > 0 ? `
            <div class="totals-row">
              <span>Tax (${Number(document.taxPercent)}%):</span>
              <span>+${formatCurrency(document.taxAmount, currency)}</span>
            </div>
          ` : ''}
          <div class="totals-row grand-total">
            <span>Total Amount:</span>
            <span class="amount">${formatCurrency(document.totalAmount, currency)}</span>
          </div>
        </div>
      </div>
    ` : ''}

    ${customSection}

    ${paymentInstructions ? `
      <div class="section-title">Payment Instructions</div>
      <div class="payment-box">
        ${escapeHtml(paymentInstructions)}
      </div>
    ` : ''}

    ${document.terms ? `
      <div class="section-title">Terms & Conditions</div>
      <div class="notes-box">${escapeHtml(document.terms)}</div>
    ` : ''}

    ${document.notes ? `
      <div class="section-title">Special Notes</div>
      <div class="notes-box">${escapeHtml(document.notes)}</div>
    ` : ''}

    <!-- Signatures -->
    <div class="signature-grid">
      <div class="sign-card">
        <div class="sign-line"></div>
        <p>Authorized Signature (Vishal Prasad)</p>
      </div>
      <div class="sign-card">
        <div class="sign-line"></div>
        <p>Client Signature & Date</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="doc-footer">
      ${escapeHtml(footerText)}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
