const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const User = require('../models/User');

function setupChatSocket(io) {
  // Authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = decoded.userId;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user.name} (${socket.userId})`);

    // Join user's personal room for direct notifications
    socket.join(`user_${socket.userId}`);

    // Join a match-specific chat room
    socket.on('join_room', (matchId) => {
      const room = `match_${matchId}`;
      socket.join(room);
      console.log(`📌 ${socket.user.name} joined room: ${room}`);
    });

    // Leave a chat room
    socket.on('leave_room', (matchId) => {
      const room = `match_${matchId}`;
      socket.leave(room);
      console.log(`📤 ${socket.user.name} left room: ${room}`);
    });

    // Send a message
    socket.on('send_message', async (data) => {
      try {
        const { matchId, receiverId, message } = data;

        if (!matchId || !receiverId || !message) {
          socket.emit('error', { message: 'matchId, receiverId, and message are required' });
          return;
        }

        // Save message to database
        const chatMessage = new Chat({
          sender: socket.userId,
          receiver: receiverId,
          matchId,
          message: message.trim(),
        });

        await chatMessage.save();

        // Populate sender info
        await chatMessage.populate('sender', 'name avatar');
        await chatMessage.populate('receiver', 'name avatar');

        const messageData = {
          _id: chatMessage._id,
          sender: chatMessage.sender,
          receiver: chatMessage.receiver,
          matchId: chatMessage.matchId,
          message: chatMessage.message,
          read: chatMessage.read,
          createdAt: chatMessage.createdAt,
        };

        // Emit to the match room
        io.to(`match_${matchId}`).emit('receive_message', messageData);

        // Also emit to receiver's personal room (for notification)
        io.to(`user_${receiverId}`).emit('new_message_notification', {
          matchId,
          message: messageData,
          senderName: socket.user.name,
        });

        console.log(`💬 Message from ${socket.user.name} in match ${matchId}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      const { matchId } = data;
      socket.to(`match_${matchId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.name,
        matchId,
      });
    });

    // Stop typing
    socket.on('stop_typing', (data) => {
      const { matchId } = data;
      socket.to(`match_${matchId}`).emit('user_stop_typing', {
        userId: socket.userId,
        matchId,
      });
    });

    // Mark messages as read
    socket.on('message_read', async (data) => {
      try {
        const { matchId } = data;

        await Chat.updateMany(
          {
            matchId,
            receiver: socket.userId,
            read: false,
          },
          { $set: { read: true } }
        );

        // Notify sender that messages were read
        socket.to(`match_${matchId}`).emit('messages_read', {
          matchId,
          readBy: socket.userId,
        });
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.user.name}`);
    });
  });
}

module.exports = { setupChatSocket };
