const mongoose = require('mongoose');

const labTestSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  slots: { type: Map, of: [String], default: {} },
  charge: { type: Number, default: 1200 },
  available: { type: Boolean, default: true },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
}, { timestamps: true });

module.exports = mongoose.model('LabTest', labTestSchema);
