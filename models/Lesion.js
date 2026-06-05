const mongoose = require('mongoose');

const scanEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true,
  },
  confidence: {
    type: Number,
    required: true,
  },
  explanation: String,
  recommendation: String,
  imagePath: String,
});

const lesionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  bodyLocation: {
    type: String,
    required: true,
  },
  latestRisk: {
    type: String,
    enum: ['low', 'medium', 'high', 'none'],
    default: 'none',
  },
  firstDetected: {
    type: Date,
    default: Date.now,
  },
  lastScan: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    default: '',
  },
  scanHistory: [scanEntrySchema],
  imagePath: {
    type: String,
    default: null,
  },
  reminderDate: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Lesion', lesionSchema);
