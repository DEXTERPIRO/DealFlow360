const prisma = require('../utils/prisma');

/**
 * List Workspaces
 */
const getWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      include: {
        _count: {
          select: { deals: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: workspaces,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Workspace
 */
const createWorkspace = async (req, res, next) => {
  try {
    const { name, slug, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Workspace name is required.' });
    }

    const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug: generatedSlug,
        description,
      },
    });

    res.status(201).json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkspaces,
  createWorkspace,
};
