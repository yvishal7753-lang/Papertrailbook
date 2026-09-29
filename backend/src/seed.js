require('dotenv').config();
const mongoose = require('mongoose');
const connectDatabase = require('./config/db');
const User = require('./models/User');
const Book = require('./models/Book');
const { validEmail } = require('./utils/validation');

const sampleBooks = [
  { title: 'The Quiet Atlas', author: 'Mira Sol', description: 'A cartographer returns to a coastal town and discovers that the maps she inherited describe places that have not yet been built. A luminous story about home, memory, and the roads between them.', price: 18.5, stock: 14, category: 'Literary fiction', isbn: '978-1-84999-100-1' },
  { title: 'Small Hours', author: 'Theo Bennett', description: 'An observant, warm collection of essays about night shifts, early trains, and the small rituals that help us feel at home in a changing world.', price: 15.0, stock: 9, category: 'Essays', isbn: '978-1-84999-100-2' },
  { title: 'A Garden for the Future', author: 'Leena Rao', description: 'A practical and hopeful guide to growing food, supporting pollinators, and making a little more room for nature wherever you live.', price: 24.0, stock: 7, category: 'Nature', isbn: '978-1-84999-100-3' },
  { title: 'The Shape of Numbers', author: 'Jonah Kim', description: 'A clear, story-led invitation to the patterns of mathematics hiding in music, architecture, and the everyday choices we make.', price: 21.75, stock: 11, category: 'Science', isbn: '978-1-84999-100-4' },
  { title: 'Before the Rain', author: 'Anika Das', description: 'Across three generations, one family learns to keep its stories alive as the monsoon reshapes the place they call home.', price: 17.25, stock: 5, category: 'Literary fiction', isbn: '978-1-84999-100-5' },
  { title: 'Good Work, Slowly', author: 'Elliot James', description: 'A thoughtful handbook for doing meaningful work with care, curiosity, and enough space to make better decisions.', price: 19.95, stock: 12, category: 'Personal growth', isbn: '978-1-84999-100-6' }
];

async function seed() {
  try {
    await connectDatabase();
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    if (!validEmail(email)) throw new Error('Set ADMIN_EMAIL to a valid email address before seeding.');
    if (password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Set ADMIN_PASSWORD to at least 10 characters and no more than 72 UTF-8 bytes before seeding.');
    const existing = await User.findOne({ email });
    if (!existing) {
      await User.create({ name: process.env.ADMIN_NAME || 'Store Administrator', email, password, role: 'admin' });
      console.log(`Administrator created: ${email}`);
    } else if (existing.role !== 'admin') {
      throw new Error(`The configured admin email ${email} already belongs to a customer account.`);
    } else {
      console.log(`Administrator already exists: ${email}`);
    }
    if (await Book.countDocuments() === 0) {
      await Book.insertMany(sampleBooks);
      console.log(`Added ${sampleBooks.length} sample books.`);
    } else {
      console.log('Books already exist; sample catalog left unchanged.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
});
