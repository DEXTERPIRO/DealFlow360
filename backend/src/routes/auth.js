const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { verifyToken, requireRoles } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const prisma = new PrismaClient();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'dealflow360_jwt_secret_2024_xyz',
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET || 'dealflow360_refresh_secret_2024_abc',
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true, sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

// Login
router.post('/login', limiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isActive)
      return res.status(403).json({ error: 'Account deactivated' });
    const { accessToken, refreshToken } = generateTokens(user);
    setRefreshCookie(res, refreshToken);
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email,
              role: user.role, avatar: user.avatar }
    });
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// Signup (internal users only)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password min 8 characters' });
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists)
      return res.status(409).json({ error: 'Email already registered' });
    const allowedRoles = ['SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'];
    const userRole = allowedRoles.includes(role) ? role : 'SALES_REP';
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: userRole }
    });
    const { accessToken, refreshToken } = generateTokens(user);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'dealflow360_refresh_secret_2024_abc');
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive)
      return res.status(401).json({ error: 'Invalid session' });
    const { accessToken, refreshToken } = generateTokens(user);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch { res.status(401).json({ error: 'Invalid refresh token' }); }
});

// Magic link for customer portal
router.post('/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'CUSTOMER')
      return res.json({ message: 'If this email exists, a link was sent' });
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { magicLinkToken: token, magicLinkExpiry: expiry }
    });
    // In production send email — for demo return token
    res.json({ message: 'Magic link sent', token, userId: user.id });
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// Verify magic link
router.post('/verify-magic', async (req, res) => {
  try {
    const { token } = req.body;
    const user = await prisma.user.findFirst({
      where: { magicLinkToken: token, magicLinkExpiry: { gt: new Date() } }
    });
    if (!user) return res.status(401).json({ error: 'Link expired or invalid' });
    await prisma.user.update({
      where: { id: user.id },
      data: { magicLinkToken: null, magicLinkExpiry: null }
    });
    const { accessToken, refreshToken } = generateTokens(user);
    setRefreshCookie(res, refreshToken);
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true,
                avatar: true, customerTier: true, companyName: true }
    });
    res.json(user);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// ── User Management (for Users page via usersAPI) ─────────────────────────

router.get('/users', verifyToken, requireRoles('ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, customerTier: true, companyName: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', verifyToken, requireRoles('ADMIN'), async (req, res) => {
  try {
    const { name, email, password, role, companyName, customerTier } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: role || 'SALES_REP',
        companyName: companyName || null,
        customerTier: customerTier || null,
        isActive: true
      },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    });
    res.status(201).json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id/status', verifyToken, requireRoles('ADMIN'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

router.put('/users/:id/reset-password', verifyToken, requireRoles('ADMIN'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashed }
    });
    res.json({ message: 'Password reset successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
