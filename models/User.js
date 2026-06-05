const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password is required only if googleId is not present
    },
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values for users without googleId
  },
  profilePicture: {
    type: String,
    default: '',
  },
  age: {
    type: Number,
  },
  skinType: {
    type: String,
    enum: ['', 'Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'],
    default: '',
  },
  medicalConditions: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isDarkMode: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationOTP: {
    type: String,
  },
  verificationOTPExpires: {
    type: Date,
  },
  resetPasswordOTP: {
    type: String,
  },
  resetPasswordOTPExpires: {
    type: Date,
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
});

// Hash the password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);
