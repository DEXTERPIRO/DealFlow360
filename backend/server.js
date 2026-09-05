require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const routes = require('./src/routes');
const errorHandler = require('./src/middleware/errorHandler');
const { initSocketHandler } = require('./src/socket/socketHandler');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// 1. Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.set('io', io);
initSocketHandler(io);

// 2. Security & Parsing Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Permissive CORS for seamless local development
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);
app.options('*', cors());

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Rate Limiting (Dev friendly defaults)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// 4. Static Uploads Serving
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'DealFlow360 API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 6. Application API Routes
app.use('/api', routes);

// 7. 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// 8. Global Error Handler
app.use(errorHandler);

// 9. Start Server
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🚀 DealFlow360 Backend Server Running`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🌐 Allowed Origin: ${FRONTEND_URL} (and local dev origins)`);
    console.log(`⚡ Socket.io Active`);
    console.log(`=========================================`);
  });
}

module.exports = { app, server };
