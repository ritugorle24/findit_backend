const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  lostItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  foundItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending',
  },
  claimDescription: {
    type: String,
    default: '',
  },
  claimStatus: {
    type: String,
    enum: ['none', 'submitted', 'approved', 'rejected'],
    default: 'none',
  },
  claimSubmittedAt: {
    type: Date,
    default: null,
  },
  suggestedBy: {
    type: String,
    enum: ['system', 'user'],
    default: 'system',
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

// Prevent duplicate matches between same item pair
matchSchema.index({ lostItem: 1, foundItem: 1 }, { unique: true });
matchSchema.index({ status: 1 });

module.exports = mongoose.model('Match', matchSchema);
