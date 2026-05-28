const mongoose = require('mongoose');

// ── Medicine ───────────────────────────────────────────────
const medicineSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  desc:  { type: String },
  image: { type: String },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
}, { timestamps: true });

// ── Medicine Order ─────────────────────────────────────────
const orderItemSchema = new mongoose.Schema({
  medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
  name:     String,
  price:    Number,
  quantity: Number,
}, { _id: false });

const medicineOrderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:   [orderItemSchema],
  total:   Number,
  address: String,
  payment: { type: String, enum: ['COD','UPI'], default: 'COD' },
  status:  { type: String, default: 'Processing' },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  hasPrescription:      { type: Boolean, default: false },
  prescriptionImage:    { type: String },
  prescriptionDoctor:   { type: String },
  prescriptionDate:     { type: String },
  prescriptionPatient:  { type: String },
  prescriptionMedicine: { type: String },
}, { timestamps: true });

medicineOrderSchema.pre('save', async function (next) {
  if (!this.orderId) {
    const prefix = 'ORD';
    const regex = new RegExp(`^${prefix}`);
    const lastOrder = await mongoose.model('MedicineOrder')
      .findOne({ orderId: regex })
      .sort({ orderId: -1 });

    let nextNum = 1;
    if (lastOrder) {
      const numericPart = parseInt(lastOrder.orderId.substring(prefix.length));
      if (!isNaN(numericPart)) {
        nextNum = numericPart + 1;
      }
    }
    this.orderId = prefix + String(nextNum).padStart(4, '0');
  }
  next();
});

module.exports = {
  Medicine:      mongoose.model('Medicine', medicineSchema),
  MedicineOrder: mongoose.model('MedicineOrder', medicineOrderSchema),
};
