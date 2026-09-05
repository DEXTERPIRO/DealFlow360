const express = require('express');
const router = express.Router();
const { uploadProduct, uploadLogo } = require('../controllers/uploadController');
const { upload, processImage } = require('../middleware/uploadMiddleware');
const { authenticate } = require('../middleware/authMiddleware');

router.post(
  '/products',
  authenticate,
  upload.single('file'),
  processImage('products', 1200),
  uploadProduct
);

router.post(
  '/logos',
  authenticate,
  upload.single('file'),
  processImage('logos', 400),
  uploadLogo
);

module.exports = router;
