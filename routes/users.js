const express = require('express');
const router = express.Router();
const { query } = require('../db');

function normalizeUser(row) {
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    is_active: row.is_active,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT user_id, full_name, email, role, phone, is_active
      FROM users
      ORDER BY user_id ASC
    `);

    res.json({ users: result.rows.map(normalizeUser) });
  } catch (error) {
    next(error);
  }
});

router.get('/:user_id', async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const result = await query(
      `
        SELECT user_id, full_name, email, role, phone, is_active
        FROM users
        WHERE user_id = $1
      `,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found', status: 404 });
    }

    return res.json({ user: normalizeUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { full_name, email, phone } = req.body || {};

    if (!full_name) {
      return res.status(400).json({ error: 'Missing required field: full_name', status: 400 });
    }

    if (!email) {
      return res.status(400).json({ error: 'Missing required field: email', status: 400 });
    }

    const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists', status: 400 });
    }

    const result = await query(
      `
        INSERT INTO users (full_name, email, password_hash, role, phone)
        VALUES ($1, $2, 'temp_hash_demo', 'patron', $3)
        RETURNING user_id, full_name, email, role
      `,
      [full_name, email, phone || null]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/:user_id', async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { full_name, phone, is_active } = req.body || {};

    const updates = [];
    const values = [];

    if (typeof full_name !== 'undefined') {
      updates.push(`full_name = $${updates.length + 1}`);
      values.push(full_name);
    }

    if (typeof phone !== 'undefined') {
      updates.push(`phone = $${updates.length + 1}`);
      values.push(phone);
    }

    if (typeof is_active !== 'undefined') {
      updates.push(`is_active = $${updates.length + 1}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update', status: 400 });
    }

    values.push(user_id);

    const result = await query(
      `
        UPDATE users
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE user_id = $${values.length}
        RETURNING user_id, full_name, email, role, phone, is_active
      `,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found', status: 404 });
    }

    return res.json({ user: normalizeUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
