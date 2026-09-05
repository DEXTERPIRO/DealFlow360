const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TIER_MAX_DISCOUNT = {
  BRONZE: 5,
  SILVER: 10,
  GOLD: 15,
};

const APPROVAL_THRESHOLDS = {
  NO_APPROVAL: 0,
  MANAGER_ONLY: 5,
  MANAGER_AND_FINANCE: 10,
};

const computeBlendedRiskScore = async (lines, customerTier) => {
  const tierMax = TIER_MAX_DISCOUNT[customerTier] || 5;
  let totalWeightedOverage = 0;
  let totalWeight = 0;
  const lineDetails = [];

  for (const line of lines) {
    const product = await prisma.product.findUnique({
      where: { id: line.productId },
      include: { category: true }
    });

    const categoryMax = product?.category?.maxDiscount || tierMax;
    const effectiveMax = Math.min(tierMax, categoryMax);
    const discount = line.discount || 0;
    const overage = Math.max(0, discount - effectiveMax);
    const weight = (line.quantity * parseFloat(line.unitPrice));

    totalWeightedOverage += overage * weight;
    totalWeight += weight;

    lineDetails.push({
      productId: line.productId,
      productName: product?.name,
      discount,
      maxAllowed: effectiveMax,
      overage,
      isFlagged: overage > 0
    });
  }

  const blendedScore = totalWeight > 0
    ? totalWeightedOverage / totalWeight : 0;

  let approvalRequired = 'NONE';
  let requiresManager = false;
  let requiresFinance = false;

  if (blendedScore > APPROVAL_THRESHOLDS.MANAGER_AND_FINANCE) {
    approvalRequired = 'MANAGER_AND_FINANCE';
    requiresManager = true;
    requiresFinance = true;
  } else if (blendedScore > APPROVAL_THRESHOLDS.MANAGER_ONLY) {
    approvalRequired = 'MANAGER_ONLY';
    requiresManager = true;
  }

  // Also check individual lines
  for (const detail of lineDetails) {
    if (detail.overage > 0) {
      requiresManager = true;
      if (detail.overage > 5) requiresFinance = true;
    }
  }

  return {
    blendedScore: parseFloat(blendedScore.toFixed(2)),
    approvalRequired,
    requiresManager,
    requiresFinance,
    lineDetails
  };
};

const computeOrderTotals = (lines) => {
  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;
  let totalCost = 0;

  for (const line of lines) {
    const baseLineTotal = line.quantity * parseFloat(line.unitPrice);
    const discountValue = baseLineTotal * (line.discount / 100);
    const afterDiscount = baseLineTotal - discountValue;
    const taxValue = afterDiscount * (line.tax / 100);

    subtotal += baseLineTotal;
    discountAmount += discountValue;
    taxAmount += taxValue;
    totalCost += line.quantity * parseFloat(line.costPrice || 0);
    line.lineTotal = afterDiscount + taxValue;
    line.margin = baseLineTotal > 0
      ? ((afterDiscount - (line.quantity * parseFloat(line.costPrice || 0)))
         / afterDiscount * 100)
      : 0;
  }

  const total = subtotal - discountAmount + taxAmount;
  const overallMargin = subtotal > 0
    ? ((subtotal - discountAmount - totalCost) / (subtotal - discountAmount) * 100)
    : 0;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    margin: parseFloat(overallMargin.toFixed(2))
  };
};

module.exports = { computeBlendedRiskScore, computeOrderTotals, TIER_MAX_DISCOUNT };
