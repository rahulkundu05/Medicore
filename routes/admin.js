const router = require('express').Router();
const User = require('../models/User');
const { Appointment, LabAppointment, EmergencyBooking } = require('../models/Appointment');
const { Medicine, MedicineOrder } = require('../models/Medicine');
const Doctor = require('../models/Doctor');
const LabTest = require('../models/LabTest');
const Hospital = require('../models/Hospital');
const auth = require('../middleware/auth');

// Admin Authorization Middleware (System Admin Only)
const adminCheck = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. System Admins only.' });
  }
  next();
};

// Admin or Hospital Authorization Middleware
const adminOrHospitalCheck = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'hospital')) {
    return res.status(403).json({ error: 'Access denied. Authorized representatives only.' });
  }
  next();
};

// Apply auth to all routes in this router
router.use(auth);

// ── SYSTEM ADMIN ONLY ENDPOINTS ───────────────────────────────────

// GET /api/admin/dashboard-stats
router.get('/dashboard-stats', adminOrHospitalCheck, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const totalPatients = await User.countDocuments({ role: 'patient' });
      const doctorApptsCount = await Appointment.countDocuments();
      const labApptsCount = await LabAppointment.countDocuments();
      const medicineOrdersCount = await MedicineOrder.countDocuments();
      const emergencyBookingsCount = await EmergencyBooking.countDocuments();

      const cancelledDocAppts = await Appointment.countDocuments({ status: 'Cancelled' });
      const confirmedDocAppts = doctorApptsCount - cancelledDocAppts;

      const cancelledLabAppts = await LabAppointment.countDocuments({ status: 'Cancelled' });
      const confirmedLabAppts = labApptsCount - cancelledLabAppts;

      res.json({
        stats: {
          totalPatients,
          doctorApptsCount,
          labApptsCount,
          medicineOrdersCount,
          emergencyBookingsCount,
          docBreakdown: { confirmed: confirmedDocAppts, cancelled: cancelledDocAppts },
          labBreakdown: { confirmed: confirmedLabAppts, cancelled: cancelledLabAppts }
        }
      });
    } else {
      // Scoped stats for Hospital representative
      const hid = req.user.hospitalId;
      const doctorApptsCount = await Appointment.countDocuments({ hospitalId: hid });
      const labApptsCount = await LabAppointment.countDocuments({ hospitalId: hid });
      const medicineOrdersCount = await MedicineOrder.countDocuments({ hospitalId: hid });
      const emergencyBookingsCount = await EmergencyBooking.countDocuments({ hospital: hid });

      const cancelledDocAppts = await Appointment.countDocuments({ hospitalId: hid, status: 'Cancelled' });
      const confirmedDocAppts = doctorApptsCount - cancelledDocAppts;

      const cancelledLabAppts = await LabAppointment.countDocuments({ hospitalId: hid, status: 'Cancelled' });
      const confirmedLabAppts = labApptsCount - cancelledLabAppts;

      res.json({
        stats: {
          totalPatients: 0,
          doctorApptsCount,
          labApptsCount,
          medicineOrdersCount,
          emergencyBookingsCount,
          docBreakdown: { confirmed: confirmedDocAppts, cancelled: cancelledDocAppts },
          labBreakdown: { confirmed: confirmedLabAppts, cancelled: cancelledLabAppts }
        }
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/hospitals – list all registered hospitals
router.get('/hospitals', adminCheck, async (req, res) => {
  try {
    const list = await Hospital.find().sort('name');
    res.json({ hospitals: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/hospitals/:id/approve – approve/disapprove a hospital
router.patch('/hospitals/:id/approve', adminCheck, async (req, res) => {
  try {
    const hosp = await Hospital.findById(req.params.id);
    if (!hosp) return res.status(404).json({ error: 'Hospital profile not found.' });

    hosp.isApproved = !hosp.isApproved;
    await hosp.save();

    res.json({ hospital: hosp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/hospitals/:id – update hospital details
router.put('/hospitals/:id', adminCheck, async (req, res) => {
  try {
    const { name, x, y, slots, email, phone, address, isApproved } = req.body;
    const hosp = await Hospital.findById(req.params.id);
    if (!hosp) return res.status(404).json({ error: 'Hospital profile not found.' });

    if (name !== undefined) hosp.name = name;
    if (x !== undefined) hosp.x = Number(x);
    if (y !== undefined) hosp.y = Number(y);
    if (slots !== undefined) hosp.slots = Number(slots);
    if (email !== undefined) hosp.email = email;
    if (phone !== undefined) hosp.phone = phone;
    if (address !== undefined) hosp.address = address;
    if (isApproved !== undefined) hosp.isApproved = Boolean(isApproved);

    await hosp.save();

    // Also update associated hospital user name if changed
    if (name !== undefined) {
      await User.updateMany({ hospitalId: hosp._id }, { name });
    }

    res.json({ hospital: hosp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/hospitals/:id – delete hospital and related details
router.delete('/hospitals/:id', adminCheck, async (req, res) => {
  try {
    const hospId = req.params.id;
    const hosp = await Hospital.findByIdAndDelete(hospId);
    if (!hosp) return res.status(404).json({ error: 'Hospital profile not found.' });

    // Clean up related data
    await User.deleteMany({ hospitalId: hospId });
    await Doctor.deleteMany({ hospitalId: hospId });
    await LabTest.deleteMany({ hospitalId: hospId });
    await Medicine.deleteMany({ hospitalId: hospId });

    res.json({ message: 'Hospital and all associated accounts/resources successfully deleted', id: hospId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users – retrieve all users on the platform
router.get('/users', adminCheck, async (req, res) => {
  try {
    const usersList = await User.find().sort('role name');
    res.json({ users: usersList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── SCOPED OR GENERAL SYSTEM ACTIONS ──────────────────────────────

// GET /api/admin/appointments/doctor
router.get('/appointments/doctor', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { hospitalId: req.user.hospitalId } : {};
    const list = await Appointment.find(query).sort('-createdAt');
    res.json({ appointments: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/appointments/lab
router.get('/appointments/lab', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { hospitalId: req.user.hospitalId } : {};
    const list = await LabAppointment.find(query).sort('-createdAt');
    res.json({ appointments: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/emergency/bookings
router.get('/emergency/bookings', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { hospital: req.user.hospitalId } : {};
    const list = await EmergencyBooking.find(query)
      .populate('user', 'name email mobile')
      .populate('hospital')
      .sort('-createdAt');
    res.json({ bookings: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/emergency/bookings/:id/status
router.patch('/emergency/bookings/:id/status', adminOrHospitalCheck, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Pending', 'Accepted', 'Resolved', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospital: req.user.hospitalId } : { _id: req.params.id };
    const booking = await EmergencyBooking.findOne(query);
    if (!booking) return res.status(404).json({ error: 'Emergency booking not found' });

    booking.status = status;
    await booking.save();

    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/emergency/bookings/:id/reassign
router.patch('/emergency/bookings/:id/reassign', adminCheck, async (req, res) => {
  try {
    const { hospitalId } = req.body;
    if (!hospitalId) return res.status(400).json({ error: 'hospitalId is required for reassignment' });

    const booking = await EmergencyBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Emergency booking not found' });

    const newHosp = await Hospital.findById(hospitalId);
    if (!newHosp) return res.status(404).json({ error: 'New hospital not found' });
    if (newHosp.slots <= 0) return res.status(400).json({ error: 'New hospital has no emergency slots available' });

    // Restore slot at old hospital
    const oldHosp = await Hospital.findById(booking.hospital);
    if (oldHosp) {
      oldHosp.slots += 1;
      await oldHosp.save();
    }

    // Deduct slot at new hospital
    newHosp.slots -= 1;
    await newHosp.save();

    booking.hospital = newHosp._id;
    booking.hospitalName = newHosp.name;
    await booking.save();

    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/medicines/orders
router.get('/medicines/orders', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { hospitalId: req.user.hospitalId } : {};
    const list = await MedicineOrder.find(query).populate('hospitalId').sort('-createdAt');
    res.json({ orders: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/appointments/doctor/:id/status
router.patch('/appointments/doctor/:id/status', adminOrHospitalCheck, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Confirmed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Confirmed or Cancelled' });
    }

    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospitalId: req.user.hospitalId } : { _id: req.params.id };
    const appt = await Appointment.findOne(query);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    appt.status = status;
    await appt.save();

    res.json({ appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/appointments/lab/:id/status
router.patch('/appointments/lab/:id/status', adminOrHospitalCheck, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Confirmed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Confirmed or Cancelled' });
    }

    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospitalId: req.user.hospitalId } : { _id: req.params.id };
    const appt = await LabAppointment.findOne(query);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    appt.status = status;
    await appt.save();

    res.json({ appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/medicines/orders/:id/status
router.patch('/medicines/orders/:id/status', adminOrHospitalCheck, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospitalId: req.user.hospitalId } : { _id: req.params.id };
    const order = await MedicineOrder.findOne(query);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = status;
    await order.save();

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DOCTOR CRUD SECTION ──────────────────────────────────────────

// GET /api/admin/doctors – fetch scoped or all doctors
router.get('/doctors', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { hospitalId: req.user.hospitalId } : {};
    const list = await Doctor.find(query).populate('hospitalId', 'name').sort('name');
    res.json({ doctors: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/doctors – add new doctor
router.post('/doctors', adminOrHospitalCheck, async (req, res) => {
  try {
    const { name, specialization, qualification, charge, available, hospitalId } = req.body;
    if (!name || !specialization || !qualification) {
      return res.status(400).json({ error: 'Name, specialization, and qualification are required.' });
    }

    let resolvedHospId = req.user.role === 'hospital' ? req.user.hospitalId : hospitalId;
    if (!resolvedHospId) {
      const firstHosp = await Hospital.findOne();
      if (firstHosp) resolvedHospId = firstHosp._id;
    }

    // Pre-populate Map of slot times for the next 31 days
    const docSlotTimes = ['10:00','11:00','12:00','14:00','15:00'];
    const slots = new Map();
    function addDays(date, days) {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    }
    function formatDate(d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    for (let i = 0; i < 31; i++) {
      slots.set(formatDate(addDays(new Date(), i)), [...docSlotTimes]);
    }

    const doc = await Doctor.create({
      name,
      specialization,
      qualification,
      charge: charge !== undefined ? Number(charge) : 500,
      available: available !== undefined ? Boolean(available) : true,
      slots,
      hospitalId: resolvedHospId
    });

    res.status(201).json({ doctor: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/doctors/:id – edit doctor details
router.patch('/doctors/:id', adminOrHospitalCheck, async (req, res) => {
  try {
    const { name, specialization, qualification, charge, available } = req.body;
    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospitalId: req.user.hospitalId } : { _id: req.params.id };
    
    const doc = await Doctor.findOne(query);
    if (!doc) return res.status(404).json({ error: 'Doctor profile not found.' });

    if (name !== undefined) doc.name = name;
    if (specialization !== undefined) doc.specialization = specialization;
    if (qualification !== undefined) doc.qualification = qualification;
    if (charge !== undefined) doc.charge = Number(charge);
    if (available !== undefined) doc.available = Boolean(available);

    await doc.save();
    res.json({ doctor: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/doctors/:id – delete doctor
router.delete('/doctors/:id', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospitalId: req.user.hospitalId } : { _id: req.params.id };
    const doc = await Doctor.findOneAndDelete(query);
    if (!doc) return res.status(404).json({ error: 'Doctor not found.' });

    res.json({ message: 'Doctor successfully deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── LAB TEST CRUD SECTION ────────────────────────────────────────

// GET /api/admin/labtests – fetch scoped or all lab tests
router.get('/labtests', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { hospitalId: req.user.hospitalId } : {};
    const list = await LabTest.find(query).populate('hospitalId', 'name').sort('name');
    res.json({ tests: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/labtests – add new lab test
router.post('/labtests', adminOrHospitalCheck, async (req, res) => {
  try {
    const { name, charge, available, hospitalId } = req.body;
    if (!name) return res.status(400).json({ error: 'Test name is required.' });

    let resolvedHospId = req.user.role === 'hospital' ? req.user.hospitalId : hospitalId;
    if (!resolvedHospId) {
      const firstHosp = await Hospital.findOne();
      if (firstHosp) resolvedHospId = firstHosp._id;
    }

    const labSlotTimes = ['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
    const slots = new Map();
    function addDays(date, days) {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    }
    function formatDate(d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    for (let i = 0; i < 31; i++) {
      slots.set(formatDate(addDays(new Date(), i)), [...labSlotTimes]);
    }

    const test = await LabTest.create({
      name,
      charge: charge !== undefined ? Number(charge) : 1200,
      available: available !== undefined ? Boolean(available) : true,
      slots,
      hospitalId: resolvedHospId
    });

    res.status(201).json({ test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/labtests/:id – edit lab test details
router.patch('/labtests/:id', adminOrHospitalCheck, async (req, res) => {
  try {
    const { name, charge, available } = req.body;
    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospitalId: req.user.hospitalId } : { _id: req.params.id };

    const test = await LabTest.findOne(query);
    if (!test) return res.status(404).json({ error: 'Lab test not found.' });

    if (name !== undefined) test.name = name;
    if (charge !== undefined) test.charge = Number(charge);
    if (available !== undefined) test.available = Boolean(available);

    await test.save();
    res.json({ test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/labtests/:id – delete lab test
router.delete('/labtests/:id', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospitalId: req.user.hospitalId } : { _id: req.params.id };
    const test = await LabTest.findOneAndDelete(query);
    if (!test) return res.status(404).json({ error: 'Lab test not found.' });

    res.json({ message: 'Lab test successfully deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── MEDICINE CRUD SECTION ────────────────────────────────────────

// GET /api/admin/medicines – fetch scoped or all medicines
router.get('/medicines', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { hospitalId: req.user.hospitalId } : {};
    const list = await Medicine.find(query).populate('hospitalId', 'name').sort('name');
    res.json({ medicines: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/medicines – add new medicine
router.post('/medicines', adminOrHospitalCheck, async (req, res) => {
  try {
    const { name, price, stock, desc, image, hospitalId } = req.body;
    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({ error: 'Name, price, and stock are required' });
    }

    let resolvedHospId = req.user.role === 'hospital' ? req.user.hospitalId : hospitalId;
    if (!resolvedHospId) {
      const firstHosp = await Hospital.findOne();
      if (firstHosp) resolvedHospId = firstHosp._id;
    }

    const med = await Medicine.create({
      name,
      price: Number(price),
      stock: Number(stock),
      desc,
      image,
      hospitalId: resolvedHospId
    });
    res.status(201).json({ medicine: med });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/medicines/:id – edit medicine
router.patch('/medicines/:id', adminOrHospitalCheck, async (req, res) => {
  try {
    const { name, price, stock, desc, image } = req.body;
    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospitalId: req.user.hospitalId } : { _id: req.params.id };

    const med = await Medicine.findOne(query);
    if (!med) return res.status(404).json({ error: 'Medicine not found' });

    if (name !== undefined) med.name = name;
    if (price !== undefined) med.price = Number(price);
    if (stock !== undefined) med.stock = Number(stock);
    if (desc !== undefined) med.desc = desc;
    if (image !== undefined) med.image = image;

    await med.save();
    res.json({ medicine: med });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/medicines/:id – delete medicine
router.delete('/medicines/:id', adminOrHospitalCheck, async (req, res) => {
  try {
    const query = req.user.role === 'hospital' ? { _id: req.params.id, hospitalId: req.user.hospitalId } : { _id: req.params.id };
    const med = await Medicine.findOneAndDelete(query);
    if (!med) return res.status(404).json({ error: 'Medicine not found' });

    res.json({ message: 'Medicine successfully deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/hospital/search-booking
router.get('/hospital/search-booking', adminOrHospitalCheck, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query parameter is required.' });

    const hid = req.user.hospitalId;
    if (!hid && req.user.role === 'hospital') {
      return res.status(400).json({ error: 'Hospital account has no linked clinical center profile.' });
    }

    // 1. Search Doctor Appointments
    let record = await Appointment.findOne({ appointmentId: query.toUpperCase().trim() }).populate('user', 'name email mobile');
    let type = 'Doctor Appointment';
    let matchId = record ? record.hospitalId : null;

    // 2. Search Lab Bookings
    if (!record) {
      record = await LabAppointment.findOne({ labId: query.toUpperCase().trim() }).populate('user', 'name email mobile');
      type = 'Lab Booking';
      matchId = record ? record.hospitalId : null;
    }

    // 3. Search Emergency Bookings
    if (!record) {
      record = await EmergencyBooking.findOne({ bookingId: query.toUpperCase().trim() }).populate('user', 'name email mobile').populate('hospital');
      type = 'Emergency Admission';
      matchId = record ? record.hospital : null;
    }

    // 4. Search Pharmacy Orders
    if (!record) {
      record = await MedicineOrder.findOne({ orderId: query.toUpperCase().trim() }).populate('user', 'name email mobile');
      type = 'Pharmacy Order';
      matchId = record ? record.hospitalId : null;
    }

    if (!record) {
      return res.status(404).json({ error: `No booking or appointment found with ID: "${query}"` });
    }

    // If hospital rep, check ownership scoping
    if (req.user.role === 'hospital') {
      if (!matchId || String(matchId._id || matchId) !== String(hid)) {
        return res.status(403).json({ error: 'Access Denied: This booking belongs to another healthcare facility.' });
      }
    }

    res.json({ type, record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
