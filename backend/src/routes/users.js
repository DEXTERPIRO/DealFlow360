const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireRoles } = require('../middleware/auth');
const prisma = new PrismaClient();

// GET /api/users — returns sales reps and managers for filter dropdowns
router.get('/', verifyToken, requireRoles('ADMIN', 'SALES_MANAGER', 'SALES_REP'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['SALES_REP', 'SALES_MANAGER'] }, isActive: true },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(users);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
