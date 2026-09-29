const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value, max = 255) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

function validBookInput(body = {}) {
  const errors = [];
  if (!text(body.title, 180)) errors.push('Enter a title of 1–180 characters.');
  if (!text(body.author, 120)) errors.push('Enter an author of 1–120 characters.');
  if (!text(body.description, 3000)) errors.push('Enter a description of 1–3000 characters.');
  if (!Number.isFinite(Number(body.price)) || Number(body.price) <= 0) errors.push('Price must be greater than zero.');
  if (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0) errors.push('Stock must be a whole number of zero or more.');
  if (body.category != null && body.category !== '' && !text(body.category, 80)) errors.push('Category must be 1–80 characters.');
  if (body.coverImage != null && body.coverImage !== '') {
    try {
      const url = new URL(body.coverImage);
      if (!['http:', 'https:'].includes(url.protocol) || body.coverImage.length > 1000) errors.push('Cover image must be an HTTP or HTTPS URL.');
    } catch { errors.push('Cover image must be an HTTP or HTTPS URL.'); }
  }
  if (body.isbn != null && (typeof body.isbn !== 'string' || body.isbn.length > 20)) errors.push('ISBN must be at most 20 characters.');
  return errors;
}

module.exports = { text, validEmail, validBookInput };
