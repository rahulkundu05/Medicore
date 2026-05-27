const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'medicore_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, age, mobile, email, password } = req.body;

    if (!name || !age || !mobile || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });

    if (!/^\d{10}$/.test(mobile))
      return res.status(400).json({ error: 'Mobile must be 10 digits' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const user = await User.create({ name, age: parseInt(age), mobile, email, password });
    const token = signToken(user._id);

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/hospital/register
router.post('/hospital/register', async (req, res) => {
  try {
    const { name, email, password, mobile, address, x, y } = req.body;

    if (!name || !email || !password || !mobile || !address)
      return res.status(400).json({ error: 'All fields are required' });

    if (!/^\d{10}$/.test(mobile))
      return res.status(400).json({ error: 'Mobile must be 10 digits' });

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) return res.status(409).json({ error: 'Email already registered' });

    const Hospital = require('../models/Hospital');
    const hospital = await Hospital.create({
      name,
      x: x !== undefined ? parseFloat(x) : 0,
      y: y !== undefined ? parseFloat(y) : 0,
      slots: 5,
      email: email.toLowerCase(),
      phone: mobile,
      address,
      isApproved: false,
    });

    const user = await User.create({
      name,
      age: 30,
      mobile,
      email: email.toLowerCase(),
      password,
      role: 'hospital',
      hospitalId: hospital._id,
    });

    res.status(201).json({
      message: 'Hospital registration submitted successfully! Your account is pending administrator approval.',
      hospital,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.role === 'hospital') {
      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findById(user.hospitalId);
      if (!hospital) {
        return res.status(404).json({ error: 'Linked hospital profile not found.' });
      }
      if (!hospital.isApproved) {
        return res.status(403).json({ error: 'Your hospital registration is pending administrator approval.' });
      }
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me  (verify token)
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
