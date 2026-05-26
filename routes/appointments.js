const router = require('express').Router();
const { Appointment, LabAppointment } = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const LabTest = require('../models/LabTest');
const auth = require('../middleware/auth');

// ─── Doctor Appointments ───────────────────────────────────

// POST /api/appointments/doctor
router.post('/doctor', auth, async (req, res) => {
  try {
    const { doctorId, date, time, symptoms } = req.body;
    if (!doctorId || !date || !time)
      return res.status(400).json({ error: 'doctorId, date, time required' });

    // Check & remove slot from doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const slots = doctor.slots.get(date) || [];
    const idx = slots.indexOf(time);
    if (idx === -1) return res.status(400).json({ error: 'Slot not available' });

    slots.splice(idx, 1);
    doctor.slots.set(date, slots);
    await doctor.save();

    const appt = await Appointment.create({
      user: req.user._id,
      patientName: req.user.name,
      patientAge: req.user.age,
      mobile: req.user.mobile,
      doctor: doctor._id,
      doctorName: doctor.name,
      doctorQualification: doctor.qualification,
      date, time, symptoms,
      hospitalId: doctor.hospitalId,
    });

    res.status(201).json({ appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/doctor  – my doctor appointments
router.get('/doctor', auth, async (req, res) => {
  try {
    const list = await Appointment.find({ user: req.user._id }).populate('hospitalId').sort('-createdAt');
    res.json({ appointments: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/appointments/doctor/:id/cancel
router.patch('/doctor/:id/cancel', auth, async (req, res) => {
  try {
    const appt = await Appointment.findOne({ _id: req.params.id, user: req.user._id });
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    if (appt.status === 'Cancelled') return res.status(400).json({ error: 'Already cancelled' });

    appt.status = 'Cancelled';
    await appt.save();

    // Restore slot
    const doctor = await Doctor.findById(appt.doctor);
    if (doctor) {
      const slots = doctor.slots.get(appt.date) || [];
      slots.push(appt.time);
      slots.sort();
      doctor.slots.set(appt.date, slots);
      await doctor.save();
    }

    res.json({ appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Lab Appointments ──────────────────────────────────────

// POST /api/appointments/lab
router.post('/lab', auth, async (req, res) => {
  try {
    const { testId, date, time } = req.body;
    if (!testId || !date || !time)
      return res.status(400).json({ error: 'testId, date, time required' });

    const test = await LabTest.findById(testId);
    if (!test) return res.status(404).json({ error: 'Lab test not found' });

    const slots = test.slots.get(date) || [];
    const idx = slots.indexOf(time);
    if (idx === -1) return res.status(400).json({ error: 'Slot not available' });

    slots.splice(idx, 1);
    test.slots.set(date, slots);
    await test.save();

    const appt = await LabAppointment.create({
      user: req.user._id,
      patientName: req.user.name,
      age: req.user.age,
      mobile: req.user.mobile,
      labTest: test._id,
      testName: test.name,
      date, time,
      hospitalId: test.hospitalId,
    });

    res.status(201).json({ appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/lab
router.get('/lab', auth, async (req, res) => {
  try {
    const list = await LabAppointment.find({ user: req.user._id }).populate('hospitalId').sort('-createdAt');
    res.json({ appointments: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/appointments/lab/:id/cancel
router.patch('/lab/:id/cancel', auth, async (req, res) => {
  try {
    const appt = await LabAppointment.findOne({ _id: req.params.id, user: req.user._id });
    if (!appt) return res.status(404).json({ error: 'Lab appointment not found' });
    if (appt.status === 'Cancelled') return res.status(400).json({ error: 'Already cancelled' });

    appt.status = 'Cancelled';
    await appt.save();

    const test = await LabTest.findById(appt.labTest);
    if (test) {
      const slots = test.slots.get(appt.date) || [];
      slots.push(appt.time);
      slots.sort();
      test.slots.set(appt.date, slots);
      await test.save();
    }

    res.json({ appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
