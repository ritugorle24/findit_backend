require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const { setupChatSocket } = require('./socket/chatSocket');
console.log("MONGO_URI:", process.env.MONGO_URI);
// Import routes
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const chatRoutes = require('./routes/chat');
const handoverRoutes = require('./routes/handover');
const leaderboardRoutes = require('./routes/leaderboard');
const notificationsRoutes = require('./routes/notifications');
const claimsRoutes = require('./routes/claims');
const userRoutes = require('./routes/users');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FindIt Campus API is running' });
});

// Make io accessible to routes
app.set('io', io);

// Setup Socket.IO chat handlers
setupChatSocket(io);

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ FindIt Campus server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for connections`);
});

module.exports = { app, server, io };
