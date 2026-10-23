// ═══════════════════════════════════════════════════════════
// Database Seeder — Freelance Business Management System
// ═══════════════════════════════════════════════════════════

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  // 1. Create Default Owner if none exists
  const existingUser = await prisma.user.findFirst();
  let owner = existingUser;

  if (!existingUser) {
    const passwordHash = await bcrypt.hash('Admin@123456', 12);
    owner = await prisma.user.create({
      data: {
        name: 'Vishal Prasad',
        email: 'vishalprasad7505@gmail.com',
        passwordHash,
        role: 'owner',
      },
    });
    console.log('Created default user: vishalprasad7505@gmail.com (Password: Admin@123456)');
  }

  // 2. Create Owner Settings
  const existingSettings = await prisma.ownerSettings.findFirst();
  if (!existingSettings && owner) {
    await prisma.ownerSettings.create({
      data: {
        userId: owner.id,
        businessName: 'Vishal Prasad — Full-Stack & UI/UX Development',
        email: 'vishalprasad7505@gmail.com',
        phone: '+91 8840243415',
        address: 'Noida / Delhi NCR, India',
        portfolioUrl: 'https://vishalprasad.dev',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        quotationPrefix: 'QUO',
        agreementPrefix: 'AGR',
        invoicePrefix: 'INV',
        receiptPrefix: 'REC',
        handoverPrefix: 'HDO',
        defaultValidityDays: 15,
        defaultPaymentTerms: '50% advance upon contract signing, 50% upon final delivery & code handover.',
        defaultRevisionTerms: 'Includes up to 2 major revision rounds during review phases.',
        paymentInstructions: 'Bank Transfer / UPI Details:\nUPI ID: vishalprasad@upi\nAccount Holder: Vishal Prasad\nBank: State Bank of India\nIFSC: SBIN0012345',
        pdfFooterText: 'Vishal Prasad • Full-Stack Web Development & Product Engineering • vishalprasad7505@gmail.com',
      },
    });
    console.log('Created owner settings.');
  }

  // 3. Create Sample Client & Project if empty
  const clientCount = await prisma.client.count();
  if (clientCount === 0) {
    const client = await prisma.client.create({
      data: {
        name: 'Rahul Sharma',
        businessName: 'NexGen Digital Labs',
        email: 'rahul@nexgendigital.com',
        phone: '+91 9876543210',
        address: 'Bangalore, Karnataka, India',
        notes: 'High priority client. Building SaaS web platform.',
        status: 'ACTIVE',
      },
    });

    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: 'NexGen SaaS Platform & Dashboard',
        projectType: 'Full-Stack Web App',
        description: 'Complete web application with auth, customer billing, and dashboard analytics.',
        agreedAmount: 85000.00,
        status: 'IN_PROGRESS',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        tasks: {
          create: [
            { title: 'Information Architecture & Wireframes', completed: true, sortOrder: 0 },
            { title: 'Frontend UI/UX Implementation', completed: true, sortOrder: 1 },
            { title: 'API Integration & Stripe Billing', completed: false, sortOrder: 2 },
            { title: 'Deployment & Acceptance Testing', completed: false, sortOrder: 3 },
          ],
        },
      },
    });

    // Sample Invoice
    const invoiceDoc = await prisma.document.create({
      data: {
        documentNumber: 'INV-2026-0001',
        type: 'INVOICE',
        status: 'ISSUED',
        clientId: client.id,
        projectId: project.id,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        title: 'Project Milestone 1 — UI/UX & Frontend Development',
        subtotal: 42500.00,
        discountAmount: 0,
        taxPercent: 18.00,
        taxAmount: 7650.00,
        totalAmount: 50150.00,
        lineItems: {
          create: [
            {
              description: 'Frontend Architecture & Modern Reactive Dashboard UI',
              quantity: 1,
              unitPrice: 42500.00,
              amount: 42500.00,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    const invoiceRecord = await prisma.invoice.create({
      data: {
        documentId: invoiceDoc.id,
        invoiceStatus: 'PARTIALLY_PAID',
        paidAmount: 25000.00,
        balance: 25150.00,
      },
    });

    // Sample Payment
    const payment = await prisma.payment.create({
      data: {
        clientId: client.id,
        projectId: project.id,
        amount: 25000.00,
        paymentDate: new Date(),
        paymentMethod: 'UPI',
        transactionRef: 'UPI-NEXGEN-009128',
        notes: 'Initial 50% deposit received via UPI',
      },
    });

    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        invoiceId: invoiceRecord.id,
        amount: 25000.00,
      },
    });

    console.log('Sample client, project, invoice, and payment seeded.');
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
