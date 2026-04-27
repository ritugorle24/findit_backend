const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const Handover = require('../models/Handover');
const Match = require('../models/Match');
const Item = require('../models/Item');
const User = require('../models/User');
const Notification = require('../models/Notification');

const router = express.Router();

// POST /api/handover/generate - Generate QR code
router.post('/generate', auth, async (req, res) => {
  try {
    const { matchId } = req.body;
    const match = await Match.findById(matchId).populate('foundItem');
    if (!match || match.foundItem.postedBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only finder can generate QR' });
    }

    const qrToken = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const handover = new Handover({
      match: matchId,
      qrToken,
      generatedBy: req.userId,
      expiresAt,
    });

    await handover.save();
    res.status(201).json({ handover });
  } catch (error) {
    res.status(500).json({ message: 'Error generating QR' });
  }
});

// POST /api/handover/verify - Scan QR (Owner scans Finder's QR)
router.post('/verify', auth, async (req, res) => {
  try {
    const { qrToken } = req.body;
    const handover = await Handover.findOne({ qrToken }).populate('match');
    if (!handover || handover.isExpired()) {
      return res.status(404).json({ message: 'Invalid or expired QR' });
    }

    // Owner confirms receipt
    handover.scannedBy = req.userId;
    handover.ownerConfirmed = true;
    await handover.save();

    // Notify Finder that Owner scanned
    await Notification.create({
      recipient: handover.generatedBy,
      title: 'QR Scanned!',
      message: 'The owner has scanned your QR. Please confirm the handover to finish.',
      type: 'HANDOVER',
      relatedId: handover._id,
    });

    res.json({ message: 'QR verified. Waiting for finder confirmation.', handover });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying QR' });
  }
});

// POST /api/handover/confirm - Finder confirms handover
router.post('/confirm', auth, async (req, res) => {
  try {
    const { handoverId } = req.body;
    const handover = await Handover.findById(handoverId).populate({
      path: 'match',
      populate: ['lostItem', 'foundItem']
    });

    if (!handover || handover.generatedBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!handover.ownerConfirmed) {
      return res.status(400).json({ message: 'Owner must scan QR first' });
    }

    handover.finderConfirmed = true;
    handover.status = 'completed';
    handover.completedAt = new Date();
    await handover.save();

    // RESOLVE ITEMS & AWARD POINTS
    await Item.findByIdAndUpdate(handover.match.lostItem._id, { status: 'resolved' });
    await Item.findByIdAndUpdate(handover.match.foundItem._id, { status: 'resolved' });
    
    // Points
    const finder = await User.findById(handover.match.foundItem.postedBy);
    finder.points += 25;
    finder.itemsReturned += 1;
    finder.checkBadges();
    await finder.save();

    // Notify Owner
    await Notification.create({
      recipient: handover.match.lostItem.postedBy,
      title: 'Handover Complete! 🎉',
      message: 'Enjoy your recovered item. Thank you for using FindIt Campus!',
      type: 'HANDOVER',
      relatedId: handover._id,
    });

    res.json({ message: 'Handover confirmed. Points awarded!', handover });
  } catch (error) {
    res.status(500).json({ message: 'Error confirming handover' });
  }
});

module.exports = router;
