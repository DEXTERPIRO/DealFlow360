const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const productsRoutes = require('./products');
const quotationsRoutes = require('./quotations');
const fulfillmentRoutes = require('./fulfillment');
const subscriptionsRoutes = require('./subscriptions');
const invoicesRoutes = require('./invoices');
const negotiationsRoutes = require('./negotiations');
const dashboardRoutes = require('./dashboard');
const notificationsRoutes = require('./notifications');
const usersRoutes = require('./users');
const configRoutes = require('./config');

// Legacy routes
const dealRoutes = require('./dealRoutes');
const uploadRoutes = require('./uploadRoutes');
const workspaceRoutes = require('./workspaceRoutes');

// Core Platform Routes
router.use('/auth', authRoutes);
router.use('/products', productsRoutes);
router.use('/quotations', quotationsRoutes);
router.use('/fulfillment', fulfillmentRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/negotiations', negotiationsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/users', usersRoutes);
router.use('/config', configRoutes);

// Compatibility
router.use('/deals', dealRoutes);
router.use('/uploads', uploadRoutes);
router.use('/workspaces', workspaceRoutes);

module.exports = router;
