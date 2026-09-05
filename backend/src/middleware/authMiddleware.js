const { verifyAccessToken } = require('../utils/jwt');
const prisma = require('../utils/prisma');

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required.',
      });
    }

    const decoded = verifyAccessToken(token);

    // Fetch user to ensure user still exists and attach to request
    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatarUrl: true,
        },
      });
    } catch (dbErr) {
      // If DB is offline or mock user fallback
      user = decoded;
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired access token.',
      error: error.message,
    });
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of: [${allowedRoles.join(', ')}]`,
      });
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
