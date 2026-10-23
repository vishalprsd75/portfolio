# ⚡ Freelance Business Management System

A private, enterprise-grade business management portal engineered for **Vishal Prasad's** freelance web development operations. Built with Node.js/Express, PostgreSQL, Prisma ORM, and modern vanilla CSS/JS styled seamlessly with the portfolio design system.

---

## 🚀 Key Modules & Capabilities

1. **Dashboard & Analytics**
   - Real-time financial KPIs: Total Collected, Outstanding Receivables, Active Projects, Directory count.
   - Interactive 6-month revenue trend visualization.
   - Upcoming project deadlines & real-time activity audit trail.
   - Quick-action shortcuts for documents, clients, and payments.

2. **Client Management**
   - Full client directory with search, filtering, and active/archive states.
   - Profile drawer with contact details, private notes, and business affiliation.
   - Client history linking associated projects, documents, and payments.

3. **Project Management**
   - End-to-end lifecycle tracking: `LEAD` → `QUOTATION_SENT` → `APPROVED` → `IN_PROGRESS` → `COMPLETED`.
   - Budget tracking, start dates, milestones, and deadlines.

4. **Document Generation Engine**
   - **5 Document Types**:
     - **Quotations (`QUO-YYYY-XXXX`)**: Estimates with customizable validity periods.
     - **Agreements (`AGR-YYYY-XXXX`)**: Formal contracts with legal clauses and signature lines.
     - **Invoices (`INV-YYYY-XXXX`)**: Milestone & final billing with real-time tax and discounts.
     - **Receipts (`REC-YYYY-XXXX`)**: Official payment receipts linked to invoices and transactions.
     - **Handovers (`HDO-YYYY-XXXX`)**: Project completion, live website URLs, and deliverable transfer checklists.
   - **Dynamic Line Items**: Real-time client-side calculation of subtotals, tax rates, discounts, and totals.
   - **Version Snapshotting**: Immutable historical snapshots on issuance.
   - **Document Relationships**: Seamless conversion flow (`Quotation` → `Agreement` → `Invoice` → `Receipt`).
   - **High-End Print & PDF Export**: Pixel-perfect printable HTML and PDF download via Puppeteer.

5. **Payment Tracking & Invoice Allocation**
   - Record multi-method payments (UPI, NEFT/IMPS, Stripe, PayPal, Cash).
   - Allocate payments directly against specific invoices.
   - Automatic invoice balance updates (`PARTIALLY_PAID`, `PAID`).
   - One-click auto-generation of official payment receipts.

6. **Owner Profile & Financial Settings**
   - Configurable business identity, GST/Tax registration number, currency (`INR`, `USD`, `EUR`, etc.).
   - Standard payment terms and default revision terms.
   - Bank / UPI payment instructions automatically injected into generated invoices.

---

## 🛠️ Quick Start Guide

### 1. Environment Setup
The application is pre-configured with SQLite for instant local execution without installing external database servers:
```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="your-secure-random-secret"
PORT=3500
```

### 2. Generate Prisma Client & Sync Database
```bash
npm run db:generate
npm run db:push
```

### 3. (Optional) Seed Demo Data
Populate the database with sample owner settings, an active client, project, invoice, and payment:
```bash
npm run db:seed
```

### 4. Start the Application
```bash
# Start in development watch mode
npm run dev

# Or start in standard production mode
npm start
```

### 5. Access the Management Portal
Open your browser and navigate to:
**[http://localhost:3500](http://localhost:3500)**

- **Default Master Admin**:
  - **Email:** `vishalprasad7505@gmail.com`
  - **Password:** `Admin@123456`
