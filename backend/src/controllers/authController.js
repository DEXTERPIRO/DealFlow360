const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const {
  generateTokens,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/jwt');

/**
 * Register User
 */
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (email, password, firstName, lastName).',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'ANALYST',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user,
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login User
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };

    const { accessToken, refreshToken } = generateTokens(safeUser);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    setRefreshTokenCookie(res, refreshToken);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: safeUser,
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh Access Token using httpOnly cookie
 */
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token cookie missing.',
      });
    }

    const decoded = verifyRefreshToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || user.refreshToken !== token) {
      clearRefreshTokenCookie(res);
      return res.status(403).json({
        success: false,
        message: 'Invalid or revoked refresh token.',
      });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };

    const tokens = generateTokens(safeUser);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    setRefreshTokenCookie(res, tokens.refreshToken);

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        user: safeUser,
      },
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    return res.status(403).json({
      success: false,
      message: 'Expired or invalid refresh token.',
      error: error.message,
    });
  }
};

/**
 * Logout User
 */
const logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      try {
        const decoded = verifyRefreshToken(token);
        await prisma.user.update({
          where: { id: decoded.id },
          data: { refreshToken: null },
        });
      } catch (err) {
        // Continue logout even if token verification fails
      }
    }

    clearRefreshTokenCookie(res);

    res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current Authenticated User
 */
const getMe = async (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
};
