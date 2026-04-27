const express = require('express');
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const Match = require('../models/Match');

const router = express.Router();

// GET /api/chat/conversations - List user's conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    // Find all matches where user is involved (ANY status)
    const matches = await Match.find({})
      .populate({
        path: 'lostItem',
        populate: { path: 'postedBy', select: 'fullName prn avatar' },
      })
      .populate({
        path: 'foundItem',
        populate: { path: 'postedBy', select: 'fullName prn avatar' },
      })
      .sort({ updatedAt: -1 });

    // Filter matches where user is involved
    const userMatches = matches.filter(match => {
      const lostUserId = match.lostItem?.postedBy?._id?.toString();
      const foundUserId = match.foundItem?.postedBy?._id?.toString();
      return lostUserId === req.userId || foundUserId === req.userId;
    });

    // For each match, get the last message and unread count
    const conversations = await Promise.all(
      userMatches.map(async (match) => {
        const lastMessage = await Chat.findOne({ matchId: match._id })
          .sort({ createdAt: -1 })
          .populate('sender', 'fullName avatar');

        const unreadCount = await Chat.countDocuments({
          matchId: match._id,
          receiver: req.userId,
          read: false,
        });

        // Determine the other user
        const isLostOwner = match.lostItem?.postedBy?._id?.toString() === req.userId;
        const otherUser = isLostOwner
          ? match.foundItem?.postedBy
          : match.lostItem?.postedBy;

        return {
          matchId: match._id,
          match,
          otherUser,
          lastMessage,
          unreadCount,
          updatedAt: lastMessage?.createdAt || match.updatedAt,
        };
      })
    );

    // Sort by most recent activity
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

// GET /api/chat/messages/:matchId - Get chat history for a match
router.get('/messages/:matchId', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Chat.find({ matchId: req.params.matchId })
      .populate('sender', 'fullName avatar')
      .populate('receiver', 'fullName avatar')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Mark messages as read
    await Chat.updateMany(
      {
        matchId: req.params.matchId,
        receiver: req.userId,
        read: false,
      },
      { $set: { read: true } }
    );

    const total = await Chat.countDocuments({ matchId: req.params.matchId });

    res.json({
      messages,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// POST /api/chat/messages - Send a new message
router.post('/messages', auth, async (req, res) => {
  try {
    const { matchId, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const match = await Match.findById(matchId).populate('lostItem foundItem');
    if (!match) return res.status(404).json({ message: 'Match not found' });

    // Determine receiver
    // Note: match.lostItem.postedBy might be an ID or populated object depending on schema
    // In our find call above, we didn't populate postedBy specifically here, but Match schema usually has it as ObjectId
    const lostUserId = match.lostItem.postedBy.toString();
    const foundUserId = match.foundItem.postedBy.toString();

    const isLostOwner = lostUserId === req.userId;
    const receiverId = isLostOwner ? foundUserId : lostUserId;

    const newMessage = new Chat({
      sender: req.userId,
      receiver: receiverId,
      matchId,
      message: content,
    });

    await newMessage.save();
    
    const populatedMessage = await Chat.findById(newMessage._id)
      .populate('sender', 'fullName avatar')
      .populate('receiver', 'fullName avatar');

    // Emit via socket
    const io = req.app.get('io');
    if (io) {
      io.to(matchId.toString()).emit('new_message', populatedMessage);
    }

    res.status(201).json({ message: 'Message sent', chatMessage: populatedMessage });
  } catch (error) {
    console.error('Post message error:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

module.exports = router;
