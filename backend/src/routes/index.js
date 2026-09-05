const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const dealRoutes = require('./dealRoutes');
const uploadRoutes = require('./uploadRoutes');
const workspaceRoutes = require('./workspaceRoutes');

router.use('/auth', authRoutes);
router.use('/deals', dealRoutes);
router.use('/uploads', uploadRoutes);
router.use('/workspaces', workspaceRoutes);

module.exports = router;
