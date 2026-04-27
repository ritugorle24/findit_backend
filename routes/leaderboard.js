const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// GET /api/leaderboard - Top users by points
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find({})
      .select('fullName prn rollNumber avatar college department points itemsReturned itemsFound badges')
      .sort({ points: -1, itemsReturned: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Add rank to each user
    const rankedUsers = users.map((user, index) => ({
      rank: skip + index + 1,
      user: user.toJSON(),
    }));

    const total = await User.countDocuments({});

    res.json({
      leaderboard: rankedUsers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
      },
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});

// GET /api/leaderboard/me - Current user's rank
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('fullName prn rollNumber avatar college department points itemsReturned itemsFound badges');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate user's rank
    const rank = await User.countDocuments({
      $or: [
        { points: { $gt: user.points } },
        {
          points: user.points,
          itemsReturned: { $gt: user.itemsReturned },
        },
      ],
    }) + 1;

    const totalUsers = await User.countDocuments({});

    res.json({
      rank,
      totalUsers,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('My rank error:', error);
    res.status(500).json({ message: 'Error fetching your rank' });
  }
});

module.exports = router;
