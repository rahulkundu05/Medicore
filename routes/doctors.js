const router = require('express').Router();
const Doctor = require('../models/Doctor');
const auth = require('../middleware/auth');

// GET /api/doctors  – list all
router.get('/', auth, async (req, res) => {
  try {
    const { specialization } = req.query;
    const filter = { available: true };
    if (specialization) filter.specialization = specialization;
    const doctors = await Doctor.find(filter).populate('hospitalId', 'name email phone address x y');
    res.json({ doctors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
router.get('/:id/slots', auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const slots = doctor.slots.get(date) || [];
    res.json({ slots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
