const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Clear all tables in correct order
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.negotiation.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.fulfillmentLine.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.quotationLine.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.upsellRule.deleteMany();
  await prisma.warehouseStock.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.priceListItem.deleteMany();
  await prisma.priceList.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.discountTier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemConfig.deleteMany();

  const hash = (p) => bcrypt.hash(p, 12);

  // USERS
  const admin = await prisma.user.create({ data: {
    name: 'Admin User', email: 'admin@dealflow.com',
    password: await hash('Admin@123'), role: 'ADMIN'
  }});
  const rep1 = await prisma.user.create({ data: {
    name: 'Priya Mehta', email: 'priya@dealflow.com',
    password: await hash('Rep@123'), role: 'SALES_REP'
  }});
  const rep2 = await prisma.user.create({ data: {
    name: 'Arjun Shah', email: 'arjun@dealflow.com',
    password: await hash('Rep@123'), role: 'SALES_REP'
  }});
  const manager = await prisma.user.create({ data: {
    name: 'Raj Patel', email: 'manager@dealflow.com',
    password: await hash('Manager@123'), role: 'SALES_MANAGER'
  }});
  const finance = await prisma.user.create({ data: {
    name: 'Sneha Joshi', email: 'finance@dealflow.com',
    password: await hash('Finance@123'), role: 'FINANCE'
  }});
  const cust1 = await prisma.user.create({ data: {
    name: 'Acme Corp', email: 'buyer@acme.com',
    password: await hash('Customer@123'), role: 'CUSTOMER',
    customerTier: 'GOLD', companyName: 'Acme Corporation',
    phone: '+91 9876543210'
  }});
  const cust2 = await prisma.user.create({ data: {
    name: 'Beta Industries', email: 'contact@beta.com',
    password: await hash('Customer@123'), role: 'CUSTOMER',
    customerTier: 'SILVER', companyName: 'Beta Industries Ltd',
    phone: '+91 9765432109'
  }});
  const cust3 = await prisma.user.create({ data: {
    name: 'Gamma Retail', email: 'purchase@gamma.com',
    password: await hash('Customer@123'), role: 'CUSTOMER',
    customerTier: 'BRONZE', companyName: 'Gamma Retail Pvt Ltd'
  }});

  // CATEGORIES with discount ceilings
  const hardware = await prisma.productCategory.create({
    data: { name: 'Hardware', maxDiscount: 15, description: 'Physical hardware products' }
  });
  const services = await prisma.productCategory.create({
    data: { name: 'Services', maxDiscount: 10, description: 'Professional services' }
  });
  const software = await prisma.productCategory.create({
    data: { name: 'Software', maxDiscount: 20, description: 'Software licenses' }
  });
  const subscriptionsCat = await prisma.productCategory.create({
    data: { name: 'Subscriptions', maxDiscount: 25, description: 'Recurring plans' }
  });

  // PRODUCTS with images placeholder
  const laptop = await prisma.product.create({ data: {
    name: 'ProBook Laptop 15"', sku: 'HW-001',
    categoryId: hardware.id, basePrice: 85000,
    costPrice: 60000, tax: 18, unit: 'piece',
    description: 'High performance business laptop with Intel i7',
    variants: { create: [
      { name: 'RAM 8GB', attribute: 'RAM', value: '8GB', extraPrice: 0 },
      { name: 'RAM 16GB', attribute: 'RAM', value: '16GB', extraPrice: 8000 },
      { name: 'RAM 32GB', attribute: 'RAM', value: '32GB', extraPrice: 18000 },
    ]}
  }});
  const monitor = await prisma.product.create({ data: {
    name: '27" 4K Monitor', sku: 'HW-002',
    categoryId: hardware.id, basePrice: 35000,
    costPrice: 24000, tax: 18, unit: 'piece',
    description: 'Ultra sharp 4K display for professionals'
  }});
  const keyboard = await prisma.product.create({ data: {
    name: 'Wireless Keyboard + Mouse', sku: 'HW-003',
    categoryId: hardware.id, basePrice: 4500,
    costPrice: 2800, tax: 18, unit: 'set',
  }});
  const setup = await prisma.product.create({ data: {
    name: 'IT Setup Service', sku: 'SV-001',
    categoryId: services.id, basePrice: 15000,
    costPrice: 8000, tax: 18, unit: 'visit',
    description: 'Professional IT setup and configuration'
  }});
  const training = await prisma.product.create({ data: {
    name: 'Staff Training (1 day)', sku: 'SV-002',
    categoryId: services.id, basePrice: 25000,
    costPrice: 12000, tax: 18, unit: 'day',
    description: 'On-site staff training by certified trainers'
  }});
  const license = await prisma.product.create({ data: {
    name: 'Office Suite License', sku: 'SW-001',
    categoryId: software.id, basePrice: 12000,
    costPrice: 6000, tax: 18, unit: 'license',
    description: 'Annual office productivity suite license'
  }});
  const support = await prisma.product.create({ data: {
    name: 'Annual Support Plan', sku: 'SUB-001',
    categoryId: subscriptionsCat.id, basePrice: 18000,
    costPrice: 8000, tax: 18, unit: 'year',
    isSubscription: true, billingCycle: 'YEARLY',
    description: 'Priority 24/7 technical support plan'
  }});
  const cloudStorage = await prisma.product.create({ data: {
    name: 'Cloud Storage 1TB', sku: 'SUB-002',
    categoryId: subscriptionsCat.id, basePrice: 2400,
    costPrice: 800, tax: 18, unit: 'month',
    isSubscription: true, billingCycle: 'MONTHLY',
    description: 'Secure cloud storage with automated backup'
  }});

  // DISCOUNT TIERS
  await prisma.discountTier.createMany({ data: [
    { tier: 'BRONZE', maxDiscount: 5, requiresManager: false, requiresFinance: false },
    { tier: 'SILVER', maxDiscount: 10, requiresManager: true, requiresFinance: false },
    { tier: 'GOLD', maxDiscount: 15, requiresManager: true, requiresFinance: true },
  ]});

  // WAREHOUSES
  const mainWH = await prisma.warehouse.create({ data: {
    name: 'Main Warehouse', location: 'Mumbai, Maharashtra',
    shippingCost: 500, isActive: true
  }});
  const eastWH = await prisma.warehouse.create({ data: {
    name: 'East Depot', location: 'Kolkata, West Bengal',
    shippingCost: 800, isActive: true
  }});
  const westWH = await prisma.warehouse.create({ data: {
    name: 'West Hub', location: 'Ahmedabad, Gujarat',
    shippingCost: 300, isActive: true
  }});

  // WAREHOUSE STOCK
  await prisma.warehouseStock.createMany({ data: [
    { warehouseId: mainWH.id, productId: laptop.id, quantity: 25, reserved: 0 },
    { warehouseId: mainWH.id, productId: monitor.id, quantity: 40, reserved: 0 },
    { warehouseId: mainWH.id, productId: keyboard.id, quantity: 80, reserved: 0 },
    { warehouseId: eastWH.id, productId: laptop.id, quantity: 8, reserved: 0 },
    { warehouseId: eastWH.id, productId: monitor.id, quantity: 12, reserved: 0 },
    { warehouseId: westWH.id, productId: laptop.id, quantity: 15, reserved: 0 },
    { warehouseId: westWH.id, productId: keyboard.id, quantity: 50, reserved: 0 },
    { warehouseId: mainWH.id, productId: license.id, quantity: 999, reserved: 0 },
    { warehouseId: mainWH.id, productId: support.id, quantity: 999, reserved: 0 },
    { warehouseId: mainWH.id, productId: cloudStorage.id, quantity: 999, reserved: 0 },
  ]});

  // PRICE LISTS
  const goldPL = await prisma.priceList.create({ data: {
    name: 'Gold Customer Pricing', tier: 'GOLD', currency: 'INR'
  }});
  await prisma.priceListItem.createMany({ data: [
    { priceListId: goldPL.id, productId: laptop.id, price: 80000 },
    { priceListId: goldPL.id, productId: monitor.id, price: 32000 },
    { priceListId: goldPL.id, productId: setup.id, price: 13000 },
  ]});

  // SUBSCRIPTION PLANS
  const monthlyPlan = await prisma.subscriptionPlan.create({ data: {
    name: 'Monthly Plan', billingCycle: 'MONTHLY',
    prorateOnChange: true, partialRefund: true,
    cancelPolicy: '30 days notice required'
  }});
  const yearlyPlan = await prisma.subscriptionPlan.create({ data: {
    name: 'Annual Plan', billingCycle: 'YEARLY',
    prorateOnChange: true, partialRefund: false,
    cancelPolicy: 'Non-refundable after 30 days'
  }});

  // UPSELL RULES
  await prisma.upsellRule.createMany({ data: [
    { sourceProductId: laptop.id, targetProductId: monitor.id, score: 90, isPromoted: true, minMargin: 20 },
    { sourceProductId: laptop.id, targetProductId: keyboard.id, score: 85, isPromoted: false, minMargin: 15 },
    { sourceProductId: laptop.id, targetProductId: setup.id, score: 70, isPromoted: true, minMargin: 25 },
    { sourceProductId: monitor.id, targetProductId: keyboard.id, score: 75, isPromoted: false, minMargin: 15 },
    { sourceProductId: setup.id, targetProductId: training.id, score: 80, isPromoted: false, minMargin: 30 },
    { sourceProductId: license.id, targetProductId: support.id, score: 95, isPromoted: true, minMargin: 40 },
  ]});

  // QUOTATIONS - multiple stages for demo
  const q1 = await prisma.quotation.create({ data: {
    quotationNumber: 'QT-2024-001',
    repId: rep1.id, customerId: cust1.id,
    customerTier: 'GOLD', status: 'APPROVED',
    blendedRiskScore: 12.5, subtotal: 285000,
    taxAmount: 51300, discountAmount: 42750,
    total: 293550, margin: 28.5,
    expiryDate: new Date(Date.now() + 30*24*60*60*1000),
    portalToken: 'portal-token-acme-001',
    lastActivityAt: new Date(),
    lines: { create: [
      { productId: laptop.id, lineType: 'ONE_TIME', quantity: 3,
        unitPrice: 85000, costPrice: 60000, discount: 12,
        tax: 18, lineTotal: 224400, margin: 22.6 },
      { productId: setup.id, lineType: 'ONE_TIME', quantity: 1,
        unitPrice: 15000, costPrice: 8000, discount: 8,
        tax: 18, lineTotal: 16270, margin: 40.0 },
    ]},
    approvals: { create: [
      { approverId: manager.id, level: 1, action: 'APPROVED',
        reason: 'Gold customer, strategic account', decidedAt: new Date() }
    ]}
  }});

  const q2 = await prisma.quotation.create({ data: {
    quotationNumber: 'QT-2024-002',
    repId: rep1.id, customerId: cust2.id,
    customerTier: 'SILVER', status: 'PENDING_MANAGER',
    blendedRiskScore: 8.2, subtotal: 145000,
    taxAmount: 26100, discountAmount: 14500,
    total: 156600, margin: 31.2,
    expiryDate: new Date(Date.now() + 15*24*60*60*1000),
    lastActivityAt: new Date(Date.now() - 2*24*60*60*1000),
    lines: { create: [
      { productId: monitor.id, lineType: 'ONE_TIME', quantity: 4,
        unitPrice: 35000, costPrice: 24000, discount: 10,
        tax: 18, lineTotal: 148680, margin: 28.9 },
    ]}
  }});

  const q3 = await prisma.quotation.create({ data: {
    quotationNumber: 'QT-2024-003',
    repId: rep2.id, customerId: cust3.id,
    customerTier: 'BRONZE', status: 'DRAFT',
    blendedRiskScore: 0, subtotal: 56000,
    taxAmount: 10080, discountAmount: 0,
    total: 66080, margin: 38.5,
    lastActivityAt: new Date(Date.now() - 5*24*60*60*1000),
    lines: { create: [
      { productId: keyboard.id, lineType: 'ONE_TIME', quantity: 10,
        unitPrice: 4500, costPrice: 2800, discount: 0,
        tax: 18, lineTotal: 53100, margin: 37.8 },
      { productId: cloudStorage.id, lineType: 'SUBSCRIPTION', quantity: 5,
        unitPrice: 2400, costPrice: 800, discount: 0,
        tax: 18, lineTotal: 14160, margin: 66.7 },
    ]}
  }});

  const q4 = await prisma.quotation.create({ data: {
    quotationNumber: 'QT-2024-004',
    repId: rep2.id, customerId: cust1.id,
    customerTier: 'GOLD', status: 'UNDER_NEGOTIATION',
    blendedRiskScore: 18.5, subtotal: 520000,
    taxAmount: 93600, discountAmount: 78000,
    total: 535600, margin: 24.1,
    expiryDate: new Date(Date.now() + 7*24*60*60*1000),
    portalToken: 'portal-token-acme-004',
    lastActivityAt: new Date(Date.now() - 1*24*60*60*1000),
    lines: { create: [
      { productId: laptop.id, lineType: 'ONE_TIME', quantity: 5,
        unitPrice: 85000, costPrice: 60000, discount: 15,
        tax: 18, lineTotal: 425000, margin: 18.8 },
      { productId: support.id, lineType: 'SUBSCRIPTION', quantity: 5,
        unitPrice: 18000, costPrice: 8000, discount: 10,
        tax: 18, lineTotal: 95310, margin: 49.7 },
    ]},
    negotiations: { create: [
      { requestedBy: cust1.id, message: 'Can you do 20% on the laptops? We are buying 5 units.',
        counterDiscount: 20, status: 'PENDING' }
    ]}
  }});

  // INVOICES
  await prisma.invoice.create({ data: {
    invoiceNumber: 'INV-2024-001',
    quotationId: q1.id, status: 'PAID',
    amount: 293550, dueDate: new Date(Date.now() - 5*24*60*60*1000),
    paidAt: new Date(Date.now() - 3*24*60*60*1000),
    paymentRef: 'NEFT-20240701-001'
  }});

  // SYSTEM CONFIG
  await prisma.systemConfig.createMany({ data: [
    { key: 'stall_threshold_days', value: '5' },
    { key: 'company_name', value: 'DealFlow360 Demo Co.' },
    { key: 'company_logo', value: '' },
    { key: 'default_currency', value: 'INR' },
    { key: 'anomaly_threshold_pct', value: '25' },
  ]});

  // AUDIT LOGS
  await prisma.auditLog.createMany({ data: [
    { quotationId: q1.id, userId: rep1.id, action: 'CREATED', details: 'Quotation created' },
    { quotationId: q1.id, userId: rep1.id, action: 'SUBMITTED', details: 'Submitted for approval' },
    { quotationId: q1.id, userId: manager.id, action: 'APPROVED', details: 'Approved by manager', metadata: { reason: 'Strategic account' } },
    { quotationId: q4.id, userId: rep2.id, action: 'SENT', details: 'Sent to customer portal' },
    { quotationId: q4.id, userId: cust1.id, action: 'NEGOTIATED', details: 'Customer requested 20% discount' },
  ]});

  console.log('\n✅ DealFlow360 seed completed successfully!\n');
  console.log('──────────────────────────────────────────');
  console.log('  ROLE        EMAIL                  PASSWORD');
  console.log('──────────────────────────────────────────');
  console.log('  Admin     : admin@dealflow.com   / Admin@123');
  console.log('  Sales Rep : priya@dealflow.com   / Rep@123');
  console.log('  Sales Rep : arjun@dealflow.com   / Rep@123');
  console.log('  Manager   : manager@dealflow.com / Manager@123');
  console.log('  Finance   : finance@dealflow.com / Finance@123');
  console.log('  Customer  : buyer@acme.com       / Customer@123');
  console.log('  Customer  : contact@beta.com     / Customer@123');
  console.log('  Customer  : purchase@gamma.com   / Customer@123');
  console.log('──────────────────────────────────────────\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
