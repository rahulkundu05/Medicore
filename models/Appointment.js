const mongoose = require('mongoose');

// ── Doctor Appointment ─────────────────────────────────────
const appointmentSchema = new mongoose.Schema({
  appointmentId:      { type: String, unique: true },
  user:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName:        String,
  patientAge:         Number,
  mobile:             String,
  doctor:             { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  doctorName:         String,
  doctorQualification:String,
  date:               { type: String, required: true },  // "YYYY-MM-DD"
  time:               { type: String, required: true },
  symptoms:           String,
  status:             { type: String, enum: ['Confirmed','Cancelled'], default: 'Confirmed' },
  hospitalId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
}, { timestamps: true });

// Auto-generate appointmentId before save
appointmentSchema.pre('save', async function (next) {
  if (!this.appointmentId) {
    const currentYear = new Date().getFullYear();
    const prefix = `APT${currentYear}`;
    const regex = new RegExp(`^${prefix}`);
    const lastAppt = await mongoose.model('Appointment')
      .findOne({ appointmentId: regex })
      .sort({ appointmentId: -1 });

    let nextNum = 1;
    if (lastAppt) {
      const numericPart = parseInt(lastAppt.appointmentId.substring(prefix.length));
      if (!isNaN(numericPart)) {
        nextNum = numericPart + 1;
      }
    }
    this.appointmentId = prefix + String(nextNum).padStart(4, '0');
  }
  next();
});

// ── Lab Appointment ────────────────────────────────────────
const labAppointmentSchema = new mongoose.Schema({
  labId:       { type: String, unique: true },
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName: String,
  age:         Number,
  mobile:      String,
  labTest:     { type: mongoose.Schema.Types.ObjectId, ref: 'LabTest', required: true },
  testName:    String,
  date:        { type: String, required: true },
  time:        { type: String, required: true },
  status:      { type: String, enum: ['Confirmed','Cancelled'], default: 'Confirmed' },
  hospitalId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
}, { timestamps: true });

labAppointmentSchema.pre('save', async function (next) {
  if (!this.labId) {
    const prefix = 'LAB';
    const regex = new RegExp(`^${prefix}`);
    const lastLab = await mongoose.model('LabAppointment')
      .findOne({ labId: regex })
      .sort({ labId: -1 });

    let nextNum = 1;
    if (lastLab) {
      const numericPart = parseInt(lastLab.labId.substring(prefix.length));
      if (!isNaN(numericPart)) {
        nextNum = numericPart + 1;
      }
    }
    this.labId = prefix + String(nextNum).padStart(4, '0');
  }
  next();
});

// ── Emergency Booking ──────────────────────────────────────
const emergencyBookingSchema = new mongoose.Schema({
  bookingId:    { type: String, unique: true },
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName:  String,
  hospital:     { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  hospitalName: String,
  status:       { type: String, enum: ['Pending', 'Accepted', 'Resolved', 'Cancelled'], default: 'Pending' }
}, { timestamps: true });

emergencyBookingSchema.pre('save', async function (next) {
  if (!this.bookingId) {
    const currentYear = new Date().getFullYear();
    const prefix = `EMG${currentYear}`;
    const regex = new RegExp(`^${prefix}`);
    const lastBooking = await mongoose.model('EmergencyBooking')
      .findOne({ bookingId: regex })
      .sort({ bookingId: -1 });

    let nextNum = 1;
    if (lastBooking) {
      const numericPart = parseInt(lastBooking.bookingId.substring(prefix.length));
      if (!isNaN(numericPart)) {
        nextNum = numericPart + 1;
      }
    }
    this.bookingId = prefix + String(nextNum).padStart(4, '0');
  }
  next();
});

module.exports = {
  Appointment:      mongoose.model('Appointment', appointmentSchema),
  LabAppointment:   mongoose.model('LabAppointment', labAppointmentSchema),
  EmergencyBooking: mongoose.model('EmergencyBooking', emergencyBookingSchema),
};
