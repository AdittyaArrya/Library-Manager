const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/library_system';

const pool = new Pool({
  connectionString,
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

async function query(sql, values = []) {
  try {
    return await pool.query(sql, values);
  } catch (error) {
    error.message = error.message || 'Database query failed';
    throw error;
  }
}

async function testConnection() {
  const result = await query('SELECT COUNT(*) AS user_count FROM users;');
  console.log('Database test query result:', result.rows[0]);
  return result.rows[0];
}

module.exports = {
  pool,
  query,
  testConnection,
};
