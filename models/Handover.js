const mongoose = require('mongoose');

const handoverSchema = new mongoose.Schema({
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
  },
  qrToken: {
    type: String,
    required: true,
    unique: true,
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired'],
    default: 'pending',
  },
  finderConfirmed: {
    type: Boolean,
    default: false,
  },
  ownerConfirmed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

// Index for token lookup
handoverSchema.index({ match: 1 });
handoverSchema.index({ status: 1, expiresAt: 1 });

// Method to check if handover is expired
handoverSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

module.exports = mongoose.model('Handover', handoverSchema);
