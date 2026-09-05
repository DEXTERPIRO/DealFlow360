const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/config — returns system config key-value pairs
router.get('/', async (req, res) => {
  try {
    const configs = await prisma.systemConfig.findMany();
    const map = {};
    for (const c of configs) {
      map[c.key] = c.value;
    }
    // Default fallbacks if not seeded
    if (!map.company_name) map.company_name = 'DealFlow360';
    res.json(map);
  } catch (e) {
    console.error(e);
    res.json({ company_name: 'DealFlow360' });
  }
});

module.exports = router;
