const express = require('express');
const auth = require('../middleware/auth');
const Item = require('../models/Item');
const Match = require('../models/Match');
const Notification = require('../models/Notification');

const router = express.Router();

// POST /api/claims - Submit a claim with security answer
router.post('/', auth, async (req, res) => {
  try {
    const { itemId, matchId, providedAnswer, description } = req.body;

    if (!providedAnswer) {
      return res.status(400).json({ message: 'Security answer is required' });
    }

    const item = await Item.findById(itemId).select('+securityAnswer +securityQuestion');
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // Verify answer (case insensitive and trimmed)
    const isCorrect = item.securityAnswer && 
                     item.securityAnswer.toLowerCase().trim() === providedAnswer.toLowerCase().trim();
    
    if (!isCorrect) {
      return res.status(403).json({ message: 'Incorrect answer. Only the real owner would know this.' });
    }

    // Proceed to create/update claim in Match
    const match = await Match.findById(matchId).populate('foundItem');
    if (!match) return res.status(404).json({ message: 'Match not found' });

    // 1. Daily Limit Check (2 per 24 hours) - Consistent with items.js
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const matchesWithClaims = await Match.find({ 
      claimSubmittedAt: { $gte: twentyFourHoursAgo },
      claimStatus: { $in: ['submitted', 'approved', 'rejected'] }
    }).populate('lostItem');

    const userClaimsIn24h = matchesWithClaims.filter(m => 
      m.lostItem && m.lostItem.postedBy.toString() === req.userId
    );

    if (userClaimsIn24h.length >= 2) {
      return res.status(429).json({ message: 'You have reached your daily claim limit' });
    }

    match.claimDescription = description || 'Verified via security question';
    match.claimStatus = 'submitted';
    match.claimSubmittedAt = new Date();
    await match.save();

    // Notify Finder
    await Notification.create({
      recipient: match.foundItem.postedBy,
      title: 'New Verified Claim',
      message: 'Someone successfully answered your security question and claimed an item.',
      type: 'CLAIM',
      relatedId: match._id,
    });

    res.json({ message: 'Claim submitted successfully', match });
  } catch (error) {
    console.error('Create claim error:', error);
    res.status(500).json({ message: 'Error submitting claim' });
  }
});

module.exports = router;
