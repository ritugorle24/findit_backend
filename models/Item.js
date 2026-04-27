const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: 1000,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Wallet',
      'ID Card',
      'Phone',
      'Bottle',
      'Earphones',
      'Bag',
      'Keys',
      'Electronics',
      'Clothing',
      'Documents',
      'Other',
    ],
  },
  type: {
    type: String,
    required: true,
    enum: ['lost', 'found'],
  },
  images: [{
    type: String,
  }],
  location: {
    building: {
      type: String,
      default: '',
    },
    floor: {
      type: String,
      default: '',
    },
    room: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
  },
  status: {
    type: String,
    enum: ['active', 'matched', 'resolved'],
    default: 'active',
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  matchedWith: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    default: null,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  color: {
    type: String,
    trim: true,
    default: '',
  },
  brand: {
    type: String,
    trim: true,
    default: '',
  },
  securityQuestion: {
    type: String,
    default: null, // e.g. "What color is the phone case?"
  },
  securityAnswer: {
    type: String,
    default: null, // e.g. "dark blue"
  },
}, {
  timestamps: true,
});

// Text index for full-text search
itemSchema.index({
  title: 'text',
  description: 'text',
  'location.building': 'text',
  'location.description': 'text',
  brand: 'text',
});

// Compound index for efficient queries
itemSchema.index({ type: 1, status: 1, createdAt: -1 });
itemSchema.index({ postedBy: 1, createdAt: -1 });
itemSchema.index({ category: 1, type: 1 });

module.exports = mongoose.model('Item', itemSchema);
