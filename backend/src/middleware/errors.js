function notFound(req, res) {
  res.status(404).json({ message: 'The requested endpoint was not found.' });
}

function errorHandler(error, req, res, next) {
  console.error(error);
  if (res.headersSent) return next(error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(error.errors).map((item) => item.message).join(' ') });
  }
  if (error.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Something went wrong. Please try again.' });
}

module.exports = { notFound, errorHandler };
