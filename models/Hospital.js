const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  x:     { type: Number, required: true },
  y:     { type: Number, required: true },
  slots: { type: Number, default: 0 },
  email:      { type: String, lowercase: true, trim: true },
  phone:      { type: String },
  address:    { type: String },
  isApproved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Hospital', hospitalSchema);
