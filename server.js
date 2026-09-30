const express = require('express');
const cors = require('cors');
const { testConnection } = require('./db');
const errorHandler = require('./middleware/errorHandler');

const usersRoutes = require('./routes/users');
const booksRoutes = require('./routes/books');
const issuesRoutes = require('./routes/issues');
const returnsRoutes = require('./routes/returns');
const reservationsRoutes = require('./routes/reservations');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Library Management System API is running',
    version: '1.0.0',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/users', usersRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/reservations', reservationsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', status: 404 });
});

app.use(errorHandler);

testConnection()
  .then((result) => {
    console.log('Database connectivity check successful:', result);
  })
  .catch((error) => {
    console.warn('Database connectivity check failed. The API will still start, but database routes require a running PostgreSQL instance.');
    console.warn(error.message);
  });

app.listen(port, () => {
  console.log(`Library backend server listening on port ${port}`);
});
