const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, default: '' },
  name: { type: String, default: '' },
  rollNumber: { type: String, default: '' },
  prn: { type: String, sparse: true },
  email: { type: String, sparse: true },
  password: { type: String, default: null },
  passwordHash: { type: String, default: null },
  avatar: { type: String, default: null },
  honestyPoints: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  itemsReturned: { type: Number, default: 0 },
  badge: { type: String, enum: ['NONE', 'FIRST_FINDER', 'HONEST_STUDENT', 'CAMPUS_HERO', 'SUPER_FINDER'], default: 'NONE' },
  role: { type: String, enum: ['STUDENT', 'STAFF'], default: 'STUDENT' },
  refreshToken: { type: String, default: null },
}, { timestamps: true });

// Comparison method
userSchema.methods.comparePassword = async function (candidatePassword) {
  const passwordField = this.passwordHash || this.password;
  if (!passwordField) return false;
  return bcrypt.compare(candidatePassword, passwordField);
};

module.exports = mongoose.model('User', userSchema);
