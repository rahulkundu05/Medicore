const router = require('express').Router();
const LabTest = require('../models/LabTest');
const auth = require('../middleware/auth');

// GET /api/labtests
router.get('/', auth, async (req, res) => {
  try {
    const tests = await LabTest.find({ available: true }).populate('hospitalId', 'name email phone address x y');
    res.json({ tests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/labtests/:id/slots?date=YYYY-MM-DD
router.get('/:id/slots', auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date param required' });

    const test = await LabTest.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Lab test not found' });

    const slots = test.slots.get(date) || [];
    res.json({ slots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
