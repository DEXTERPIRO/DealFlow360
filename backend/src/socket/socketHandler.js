const { computeBlendedRiskScore, computeOrderTotals } = require('../utils/blendedRiskEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Real-Time Socket.io Handler
 */
const initSocketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`⚡ [Socket.io] Client connected: ${socket.id}`);

    // Join Dashboard room
    socket.on('join_dashboard', () => {
      socket.join('dashboard');
      console.log(`📊 Socket ${socket.id} joined dashboard room`);
    });
    socket.on('join:dashboard', () => {
      socket.join('dashboard');
    });

    // Join Approvals queue room
    socket.on('join_approvals', () => {
      socket.join('approvers');
      console.log(`🛡️ Socket ${socket.id} joined approvers room`);
    });
    socket.on('join:approvals', () => {
      socket.join('approvers');
    });

    // Join Customer Portal room
    socket.on('join_portal', (token) => {
      const room = typeof token === 'object' ? token?.token : token;
      if (room) {
        socket.join(`portal_${room}`);
        console.log(`🌐 Socket ${socket.id} joined portal room: portal_${room}`);
      }
    });

    // Join Quotation room
    socket.on('join:quotation', (quotationId) => {
      socket.join(`quotation_${quotationId}`);
    });

    // Join Workspace room
    socket.on('join:workspace', (workspaceId) => {
      socket.join(`workspace_${workspaceId}`);
    });

    // Broadcast user presence or active typing/editing
    socket.on('deal:activity', (data) => {
      if (data.dealId) {
        socket.to(`deal_${data.dealId}`).emit('deal:activity_received', data);
      }
    });

    // Live Risk Score Compute over WebSocket
    socket.on('compute-risk-live', async (payload) => {
      try {
        const { lines, customerTier } = payload || {};
        if (!lines || !lines.length) {
          return socket.emit('risk-result', {
            blendedScore: 0,
            requiresManager: false,
            requiresFinance: false,
            totals: { subtotal: 0, total: 0, margin: 0, discountAmount: 0 }
          });
        }

        const enrichedLines = await Promise.all(
          lines.map(async (line) => {
            const product = await prisma.product.findUnique({
              where: { id: line.productId }
            });
            return {
              ...line,
              costPrice: product?.costPrice || 0,
              tax: product?.tax || 18
            };
          })
        );

        const totals = computeOrderTotals(enrichedLines);
        const risk = await computeBlendedRiskScore(enrichedLines, customerTier || 'BRONZE');

        socket.emit('risk-result', {
          ...risk,
          totals
        });
      } catch (err) {
        console.error('Socket risk compute error:', err);
        socket.emit('risk-result', { error: 'Failed to compute risk' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = {
  initSocketHandler,
};
