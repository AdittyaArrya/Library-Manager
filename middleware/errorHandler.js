module.exports = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (status === 404) {
    return res.status(404).json({ error: message || 'Resource not found', status: 404 });
  }

  if (status === 400) {
    return res.status(400).json({ error: message, status: 400 });
  }

  console.error('Unhandled error:', err);
  return res.status(status).json({ error: message, status });
};
