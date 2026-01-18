// WebRTC Call & Whiteboard Signaling Handlers
// Add this to your backend1/server.js Socket.io setup

module.exports = function setupCallHandlers(io) {
  
  io.on('connection', (socket) => {
    console.log('Socket connected for calls:', socket.id);

    // Call Management
    socket.on('join-call', ({ roomId, userId }) => {
      console.log(`User ${userId} joining call room: ${roomId}`);
      socket.join(roomId);
      
      // Notify others in the room
      socket.to(roomId).emit('call-user-joined', { userId, roomId });
    });

    socket.on('leave-call', ({ roomId, userId }) => {
      console.log(`User ${userId} leaving call room: ${roomId}`);
      socket.leave(roomId);
      
      // Notify others
      socket.to(roomId).emit('call-user-left', { userId });
    });

    // WebRTC Signaling
    socket.on('call-offer', ({ to, offer, roomId }) => {
      console.log(`Forwarding offer in room ${roomId}`);
      socket.to(roomId).emit('call-offer', {
        from: socket.id,
        offer
      });
    });

    socket.on('call-answer', ({ to, answer, roomId }) => {
      console.log(`Forwarding answer in room ${roomId}`);
      socket.to(roomId).emit('call-answer', {
        from: socket.id,
        answer
      });
    });

    socket.on('call-ice-candidate', ({ to, candidate, roomId }) => {
      socket.to(roomId).emit('call-ice-candidate', {
        from: socket.id,
        candidate
      });
    });

    // Whiteboard Events
    socket.on('whiteboard-draw', ({ roomId, event }) => {
      // Broadcast to all except sender
      socket.to(roomId).emit('whiteboard-draw', event);
    });

    socket.on('whiteboard-clear', ({ roomId }) => {
      socket.to(roomId).emit('whiteboard-clear');
    });

    socket.on('whiteboard-permissions-update', ({ roomId, permissions }) => {
      socket.to(roomId).emit('whiteboard-permissions', permissions);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected from call:', socket.id);
    });
  });
};
