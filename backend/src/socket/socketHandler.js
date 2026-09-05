/**
 * Real-Time Socket.io Handler
 */
const initSocketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`⚡ [Socket.io] Client connected: ${socket.id}`);

    // Join Deal room
    socket.on('join:deal', (dealId) => {
      socket.join(`deal_${dealId}`);
      console.log(`👥 Socket ${socket.id} joined deal room: deal_${dealId}`);
    });

    // Leave Deal room
    socket.on('leave:deal', (dealId) => {
      socket.leave(`deal_${dealId}`);
      console.log(`👋 Socket ${socket.id} left deal room: deal_${dealId}`);
    });

    // Join Workspace room
    socket.on('join:workspace', (workspaceId) => {
      socket.join(`workspace_${workspaceId}`);
      console.log(`👥 Socket ${socket.id} joined workspace: workspace_${workspaceId}`);
    });

    // Broadcast user presence or active typing/editing
    socket.on('deal:activity', (data) => {
      if (data.dealId) {
        socket.to(`deal_${data.dealId}`).emit('deal:activity_received', data);
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
