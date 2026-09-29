const express = require('express');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validBookInput } = require('../utils/validation');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const filter = { stock: { $gt: 0 } };
    if (search) filter.$or = ['title', 'author', 'description', 'category'].map((field) => ({ [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
    const books = await Book.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ books });
  } catch (error) { next(error); }
});

router.get('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 }).limit(250).lean();
    res.json({ books });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Book not found.' });
    const book = await Book.findById(req.params.id);
    if (!book || book.stock < 1) return res.status(404).json({ message: 'Book not found.' });
    res.json({ book });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validBookInput(body);
    if (errors.length) return res.status(400).json({ message: errors.join(' ') });
    const book = await Book.create({ ...body, category: body.category?.trim() || 'General' });
    res.status(201).json({ book, message: 'Book added to the catalog.' });
  } catch (error) { next(error); }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Book not found.' });
    const body = req.body || {};
    const errors = validBookInput(body);
    if (errors.length) return res.status(400).json({ message: errors.join(' ') });
    const book = await Book.findByIdAndUpdate(req.params.id, { ...body, category: body.category?.trim() || 'General' }, { new: true, runValidators: true });
    if (!book) return res.status(404).json({ message: 'Book not found.' });
    res.json({ book, message: 'Book details updated.' });
  } catch (error) { next(error); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Book not found.' });
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found.' });
    res.json({ message: 'Book removed from the catalog.' });
  } catch (error) { next(error); }
});

module.exports = router;
