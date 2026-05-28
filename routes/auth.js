const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { sendRegistrationOtp, checkSmtpConfigured } = require('../utils/mailer');

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
    
    // Generate a 6-digit random OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    if (exists) {
      if (exists.isVerified) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // If they exist but are not verified, we allow them to re-register/update their details.
      // This prevents unverified account lockouts/duplicate errors.
      exists.name = name;
      exists.age = parseInt(age);
      exists.mobile = mobile;
      exists.password = password; // mongoose pre-save hook handles hashing!
      exists.otp = otp;
      exists.otpExpires = otpExpires;
      await exists.save();

      if (!checkSmtpConfigured()) {
        return res.status(200).json({
          message: 'Account details updated. (SMTP not configured, demo OTP: ' + otp + ')',
          email: exists.email,
          emailDeliveryFailed: true,
          otp
        });
      }

      // Dispatch real email in background
      sendRegistrationOtp(exists.email, otp).catch(err => {
        console.error("❌ [Background SMTP Mailer] Failed to send register update email:", err.message);
      });

      return res.status(200).json({
        message: 'Account details updated. A new verification OTP has been sent to your email.',
        email: exists.email
      });
    }

    // Create a new unverified user
    const user = await User.create({
      name,
      age: parseInt(age),
      mobile,
      email: email.toLowerCase(),
      password,
      isVerified: false,
      otp,
      otpExpires,
    });

    if (!checkSmtpConfigured()) {
      return res.status(201).json({
        message: 'Account registered. (SMTP not configured, demo OTP: ' + otp + ')',
        email: user.email,
        emailDeliveryFailed: true,
        otp
      });
    }

    // Dispatch real email in background
    sendRegistrationOtp(user.email, otp).catch(err => {
      console.error("❌ [Background SMTP Mailer] Failed to send register email:", err.message);
    });

    res.status(201).json({
      message: 'Account registered. Verification OTP sent to email.',
      email: user.email
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ error: 'No OTP code requested for this account' });
    }

    if (user.otpExpires < new Date()) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
    }

    if (user.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect OTP. Please check the code and try again.' });
    }

    // Verification successful
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = signToken(user._id);

    res.status(200).json({
      message: 'Email verified successfully!',
      token,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate a fresh OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    if (!checkSmtpConfigured()) {
      return res.status(200).json({
        message: 'A fresh OTP has been generated. (SMTP not configured, demo OTP: ' + otp + ')',
        email: user.email,
        emailDeliveryFailed: true,
        otp
      });
    }

    // Dispatch real email in background
    sendRegistrationOtp(user.email, otp).catch(err => {
      console.error("❌ [Background SMTP Mailer] Failed to send resend-otp email:", err.message);
    });

    res.status(200).json({
      message: 'A fresh OTP has been sent to your email.',
      email: user.email
    });
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
      isVerified: true, // Hospital registration undergoes admin approval instead
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

    // Block unverified email users
    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Please verify your email address first. An OTP code is required.',
        isUnverified: true,
        email: user.email
      });
    }

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
