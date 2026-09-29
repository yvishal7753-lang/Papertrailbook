const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { text, validEmail } = require('../utils/validation');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many sign-in attempts. Please try again in 15 minutes.' } });

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function setSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('bookstore_session', token, cookieOptions());
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!text(name, 100) || !validEmail(email) || typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ message: 'Enter your name and a valid email. Passwords must be at least 10 characters and no more than 72 UTF-8 bytes.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with that email already exists.' });
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password, role: 'customer' });
    setSession(res, user);
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (error) { next(error); }
});

async function login(req, res, next, adminOnly) {
  try {
    const { email, password } = req.body || {};
    if (!validEmail(email) || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ message: 'Enter a valid email and password.' });
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    if (adminOnly && user.role !== 'admin') return res.status(403).json({ message: 'This sign-in is for administrators only.' });
    setSession(res, user);
    res.json({ user: user.toSafeJSON() });
  } catch (error) { next(error); }
}

router.post('/login', authLimiter, (req, res, next) => login(req, res, next, false));
router.post('/admin/login', authLimiter, (req, res, next) => login(req, res, next, true));
router.post('/logout', (req, res) => {
  res.clearCookie('bookstore_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  res.json({ message: 'You are signed out.' });
});
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafeJSON() }));

module.exports = router;
