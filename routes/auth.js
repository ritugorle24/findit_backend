const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate tokens helper
const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    console.log('REGISTER BODY RECEIVED:', req.body);
    
    const { fullName, rollNumber, prn, password, confirmPassword } = req.body;

    if (!fullName || !rollNumber || !prn || !password || !confirmPassword) {
      return res.status(400).json({ 
        message: 'All fields are required',
        received: { fullName, rollNumber, prn, hasPassword: !!password }
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ 
      $or: [{ prn }, { rollNumber }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'PRN or Roll Number already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    const user = await User.create({ 
      fullName, 
      rollNumber, 
      prn, 
      passwordHash,
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    user.refreshToken = refreshToken;
    await user.save();

    return res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        prn: user.prn,
        rollNumber: user.rollNumber,
        badge: user.badge,
        honestyPoints: user.honestyPoints,
        itemsReturned: user.itemsReturned,
        role: user.role,
        avatar: user.avatar,
      }
    });
  } catch (error) {
    console.error('REGISTER ERROR DETAILS:', error.message);
    return res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    console.log('LOGIN BODY RECEIVED:', req.body);
    
    const { prn, password } = req.body;

    if (!prn || !password) {
      return res.status(400).json({ message: 'PRN and password are required' });
    }

    const user = await User.findOne({ 
      $or: [{ prn: prn }, { email: prn }] 
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid PRN or password' });
    }

    const passwordField = user.passwordHash || user.password;
    if (!passwordField) {
      return res.status(401).json({ message: 'Account not set up correctly. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, passwordField);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid PRN or password' });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName || user.name || 'Student',
        prn: user.prn || user.email,
        rollNumber: user.rollNumber || '',
        badge: user.badge || 'NONE',
        honestyPoints: user.honestyPoints || user.points || 0,
        itemsReturned: user.itemsReturned || 0,
        role: user.role || 'STUDENT',
        avatar: user.avatar || null,
      }
    });
  } catch (error) {
    console.error('LOGIN ERROR DETAILS:', error.message);
    return res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const accessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during logout' });
  }
});

module.exports = router;
