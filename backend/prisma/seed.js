const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for DealFlow360...');

  // Clean existing records if any
  try {
    await prisma.activityLog.deleteMany();
    await prisma.dealAttachment.deleteMany();
    await prisma.deal.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
  } catch (err) {
    console.log('Tables might be freshly initialized, proceeding...');
  }

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Create default workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Global M&A Advisory',
      slug: 'global-ma-advisory',
      description: 'Primary cross-border mergers & acquisitions workspace',
    },
  });

  // 2. Create users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@dealflow360.internal',
      password: hashedPassword,
      firstName: 'Elena',
      lastName: 'Vance',
      role: 'ADMIN',
    },
  });

  const broker = await prisma.user.create({
    data: {
      email: 'broker@dealflow360.internal',
      password: hashedPassword,
      firstName: 'Marcus',
      lastName: 'Sterling',
      role: 'BROKER',
    },
  });

  const client = await prisma.user.create({
    data: {
      email: 'client@dealflow360.internal',
      password: hashedPassword,
      firstName: 'Sophia',
      lastName: 'Chen',
      role: 'CLIENT',
    },
  });

  // 3. Create Sample Deals
  const deals = [
    {
      title: 'Acquisition of CloudScale Networks',
      targetCompany: 'CloudScale Inc',
      industry: 'Enterprise Software & Cloud',
      dealValue: 45000000.0,
      stage: 'DUE_DILIGENCE',
      priority: 'HIGH',
      probability: 65,
      description: 'Strategic cloud-native infrastructure acquisition to augment core edge compute capabilities.',
      ownerId: broker.id,
      workspaceId: workspace.id,
    },
    {
      title: 'BioGenix Series B Cross-Border Merger',
      targetCompany: 'BioGenix Pharma',
      industry: 'Biotechnology & Healthcare',
      dealValue: 72000000.0,
      stage: 'NEGOTIATION',
      priority: 'URGENT',
      probability: 80,
      description: 'Oncology pipeline consolidation and international intellectual property licensing agreement.',
      ownerId: admin.id,
      workspaceId: workspace.id,
    },
    {
      title: 'FinEdge Micro-Payments Platform Buyout',
      targetCompany: 'FinEdge Labs',
      industry: 'Fintech & Payments',
      dealValue: 28000000.0,
      stage: 'QUALIFICATION',
      priority: 'MEDIUM',
      probability: 45,
      description: 'Southeast Asian real-time payments corridor platform buyout.',
      ownerId: broker.id,
      workspaceId: workspace.id,
    },
    {
      title: 'AeroDynamics Autonomous Drone Asset Sale',
      targetCompany: 'AeroDynamics Corp',
      industry: 'Defense & Aerospace',
      dealValue: 110000000.0,
      stage: 'CLOSED_WON',
      priority: 'HIGH',
      probability: 100,
      description: 'Successful divestiture of autonomous reconnaissance wing to defense prime contractor.',
      ownerId: broker.id,
      workspaceId: workspace.id,
    },
    {
      title: 'Solaria Clean Energy Grid Integration',
      targetCompany: 'Solaria Systems',
      industry: 'Clean Energy & Renewables',
      dealValue: 35000000.0,
      stage: 'LEAD',
      priority: 'LOW',
      probability: 25,
      description: 'Preliminary mandate for utility-scale smart inverter infrastructure rollout.',
      ownerId: admin.id,
      workspaceId: workspace.id,
    },
  ];

  for (const dealData of deals) {
    const createdDeal = await prisma.deal.create({ data: dealData });

    await prisma.activityLog.create({
      data: {
        dealId: createdDeal.id,
        userId: createdDeal.ownerId,
        action: 'DEAL_CREATED',
        details: `Deal "${createdDeal.title}" created with stage ${createdDeal.stage}`,
      },
    });
  }

  console.log('✅ Seed completed successfully!');
  console.log(`   Admin: admin@dealflow360.internal / Password123!`);
  console.log(`   Broker: broker@dealflow360.internal / Password123!`);
  console.log(`   Client: client@dealflow360.internal / Password123!`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
