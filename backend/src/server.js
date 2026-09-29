require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/db');

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters.');
  await connectDatabase();
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => console.log(`Papertrail API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error('Could not start the API:', error.message);
  process.exit(1);
});
