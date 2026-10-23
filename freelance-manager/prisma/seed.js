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

  console.log('Seed completed successfully (User & Owner Settings verified)!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
