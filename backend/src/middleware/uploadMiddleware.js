const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directories exist
const uploadBaseDir = path.resolve(__dirname, '../uploads');
const productsDir = path.join(uploadBaseDir, 'products');
const logosDir = path.join(uploadBaseDir, 'logos');

[productsDir, logosDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Use memory storage for Multer to allow Sharp in-memory processing
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only JPEG, PNG, WEBP, GIF, and PDF are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter,
});

/**
 * Middleware to optimize and resize uploaded image using Sharp
 */
const processImage = (subfolder, targetWidth = 800) => {
  return async (req, res, next) => {
    if (!req.file) return next();

    // If it's a PDF or non-image, save as is
    if (req.file.mimetype === 'application/pdf') {
      const fileName = `${uuidv4()}-${req.file.originalname}`;
      const filePath = path.join(uploadBaseDir, subfolder, fileName);
      fs.writeFileSync(filePath, req.file.buffer);
      req.processedFile = {
        fileName,
        originalName: req.file.originalname,
        filePath: `/uploads/${subfolder}/${fileName}`,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      };
      return next();
    }

    try {
      const fileName = `${uuidv4()}.webp`;
      const targetDir = path.join(uploadBaseDir, subfolder);
      const outputFilePath = path.join(targetDir, fileName);

      await sharp(req.file.buffer)
        .resize({ width: targetWidth, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(outputFilePath);

      const stats = fs.statSync(outputFilePath);

      req.processedFile = {
        fileName,
        originalName: req.file.originalname,
        filePath: `/uploads/${subfolder}/${fileName}`,
        mimeType: 'image/webp',
        fileSize: stats.size,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  upload,
  processImage,
};
