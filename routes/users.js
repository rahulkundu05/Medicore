const router = require('express').Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/users/profile
router.get('/profile', auth, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/users/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, age, mobile } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!age || age < 1 || age > 120) return res.status(400).json({ error: 'Valid age required (1-120)' });
    if (!/^\d{10}$/.test(mobile)) return res.status(400).json({ error: 'Mobile must be 10 digits' });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, age: parseInt(age), mobile },
      { new: true, runValidators: true }
    );
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
