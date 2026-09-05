const express = require('express');
const router = express.Router();
const {
  getDeals,
  getDealById,
  createDeal,
  updateDeal,
  deleteDeal,
  exportDealPdf,
  getPipelineStats,
} = require('../controllers/dealController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/stats', getPipelineStats);
router.get('/', getDeals);
router.get('/:id', getDealById);
router.get('/:id/pdf', exportDealPdf);

// Protected mutation routes
router.post('/', authenticate, createDeal);
router.put('/:id', authenticate, updateDeal);
router.delete('/:id', authenticate, deleteDeal);

module.exports = router;
