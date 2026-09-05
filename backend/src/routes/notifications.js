const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/auth');
const prisma = new PrismaClient();

// GET all notifications for logged in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(notifications);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT mark single notification as read
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const notif = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true }
    });
    res.json({ success: true, count: notif.count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PUT mark all notifications as read
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    const updated = await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true, count: updated.count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

module.exports = router;
