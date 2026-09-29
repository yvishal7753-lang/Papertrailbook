const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  author: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  price: { type: Number, required: true, min: 0.01 },
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
  category: { type: String, trim: true, maxlength: 80, default: 'General' },
  coverImage: { type: String, trim: true, maxlength: 1000, default: '' },
  isbn: { type: String, trim: true, maxlength: 20, default: '' }
}, { timestamps: true });

bookSchema.index({ title: 'text', author: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Book', bookSchema);
