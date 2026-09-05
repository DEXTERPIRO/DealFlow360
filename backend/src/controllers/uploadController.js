const prisma = require('../utils/prisma');

/**
 * Handle Product Asset Upload
 */
const uploadProduct = async (req, res, next) => {
  try {
    if (!req.processedFile) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded or file processing failed.',
      });
    }

    const { dealId } = req.body;

    let attachment = null;
    if (dealId) {
      attachment = await prisma.dealAttachment.create({
        data: {
          dealId,
          fileName: req.processedFile.fileName,
          originalName: req.processedFile.originalName,
          filePath: req.processedFile.filePath,
          mimeType: req.processedFile.mimeType,
          fileSize: req.processedFile.fileSize,
          uploadedBy: req.user?.id || 'anonymous',
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Product asset uploaded and optimized successfully.',
      data: {
        file: req.processedFile,
        attachment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Logo Upload
 */
const uploadLogo = async (req, res, next) => {
  try {
    if (!req.processedFile) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded or file processing failed.',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Logo uploaded and optimized successfully.',
      data: {
        file: req.processedFile,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadProduct,
  uploadLogo,
};
