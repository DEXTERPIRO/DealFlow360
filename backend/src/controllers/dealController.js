const prisma = require('../utils/prisma');
const { generateDealPDF } = require('../utils/pdfGenerator');

/**
 * Get all deals with optional stage or priority filters
 */
const getDeals = async (req, res, next) => {
  try {
    const { stage, priority, search, workspaceId } = req.query;

    const where = {};
    if (stage) where.stage = stage;
    if (priority) where.priority = priority;
    if (workspaceId) where.workspaceId = workspaceId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { targetCompany: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
      ];
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        attachments: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      count: deals.length,
      data: deals,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Deal by ID
 */
const getDealById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        workspace: true,
        attachments: true,
        activities: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found.',
      });
    }

    res.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new Deal
 */
const createDeal = async (req, res, next) => {
  try {
    const {
      title,
      targetCompany,
      industry,
      dealValue,
      stage,
      priority,
      probability,
      description,
      workspaceId,
      closeDate,
    } = req.body;

    if (!title || !targetCompany) {
      return res.status(400).json({
        success: false,
        message: 'Title and Target Company are required fields.',
      });
    }

    const deal = await prisma.deal.create({
      data: {
        title,
        targetCompany,
        industry: industry || 'General',
        dealValue: dealValue ? parseFloat(dealValue) : 0,
        stage: stage || 'LEAD',
        priority: priority || 'MEDIUM',
        probability: probability ? parseInt(probability, 10) : 20,
        description,
        closeDate: closeDate ? new Date(closeDate) : null,
        ownerId: req.user?.id || null,
        workspaceId: workspaceId || null,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        workspace: { select: { id: true, name: true } },
      },
    });

    // Record activity
    await prisma.activityLog.create({
      data: {
        dealId: deal.id,
        userId: req.user?.id || null,
        action: 'DEAL_CREATED',
        details: `Deal "${deal.title}" created.`,
      },
    });

    // Broadcast through socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.emit('deal:created', deal);
    }

    res.status(201).json({
      success: true,
      message: 'Deal created successfully.',
      data: deal,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Deal
 */
const updateDeal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.dealValue !== undefined) updateData.dealValue = parseFloat(updateData.dealValue);
    if (updateData.probability !== undefined) updateData.probability = parseInt(updateData.probability, 10);
    if (updateData.closeDate) updateData.closeDate = new Date(updateData.closeDate);

    const oldDeal = await prisma.deal.findUnique({ where: { id } });
    if (!oldDeal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const updatedDeal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        workspace: { select: { id: true, name: true } },
        attachments: true,
      },
    });

    // Record Stage change activity if changed
    if (updateData.stage && updateData.stage !== oldDeal.stage) {
      await prisma.activityLog.create({
        data: {
          dealId: updatedDeal.id,
          userId: req.user?.id || null,
          action: 'STAGE_CHANGED',
          details: `Stage updated from ${oldDeal.stage} to ${updateData.stage}`,
        },
      });
    }

    // Broadcast real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('deal:updated', updatedDeal);
      io.to(`deal_${id}`).emit('deal:detail_updated', updatedDeal);
    }

    res.json({
      success: true,
      message: 'Deal updated successfully.',
      data: updatedDeal,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Deal
 */
const deleteDeal = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.deal.delete({
      where: { id },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('deal:deleted', { id });
    }

    res.json({
      success: true,
      message: 'Deal deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate PDF Report for Deal
 */
const exportDealPdf = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        owner: true,
        workspace: true,
      },
    });

    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=DealFlow360-Deal-${id}.pdf`);

    generateDealPDF(deal, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Pipeline Statistics (counts per stage, total value)
 */
const getPipelineStats = async (req, res, next) => {
  try {
    const deals = await prisma.deal.findMany();

    const stages = ['LEAD', 'QUALIFICATION', 'DUE_DILIGENCE', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
    const stageCounts = {};
    const stageValues = {};

    stages.forEach((s) => {
      stageCounts[s] = 0;
      stageValues[s] = 0;
    });

    let totalValuation = 0;

    deals.forEach((deal) => {
      const stage = deal.stage;
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      stageValues[stage] = (stageValues[stage] || 0) + deal.dealValue;
      totalValuation += deal.dealValue;
    });

    res.json({
      success: true,
      data: {
        totalDeals: deals.length,
        totalValuation,
        stageCounts,
        stageValues,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDeals,
  getDealById,
  createDeal,
  updateDeal,
  deleteDeal,
  exportDealPdf,
  getPipelineStats,
};
