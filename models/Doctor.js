const mongoose = require('mongoose');

// slots: { "2025-01-15": ["10:00","11:00",...], ... }
const doctorSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  specialization: { type: String, required: true },
  qualification:  { type: String, required: true },
  slots:          { type: Map, of: [String], default: {} },
  charge:         { type: Number, default: 500 },
  available:      { type: Boolean, default: true },
  hospitalId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema);
