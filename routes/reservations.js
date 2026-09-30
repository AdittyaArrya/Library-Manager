const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `
        SELECT reservation_id, user_id, book_id, status, reserved_at, expires_at
        FROM reservations
        ORDER BY reservation_id ASC
      `
    );

    res.json({ reservations: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/user/:user_id', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM reservations WHERE user_id = $1 ORDER BY reservation_id ASC',
      [req.params.user_id]
    );

    return res.json({ reservations: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/book/:book_id', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM reservations WHERE book_id = $1 ORDER BY reservation_id ASC',
      [req.params.book_id]
    );

    return res.json({ reservations: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { user_id, book_id, expire_days } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ error: 'Missing required field: user_id', status: 400 });
    }

    if (!book_id) {
      return res.status(400).json({ error: 'Missing required field: book_id', status: 400 });
    }

    if (!expire_days) {
      return res.status(400).json({ error: 'Missing required field: expire_days', status: 400 });
    }

    const user = await query('SELECT 1 FROM users WHERE user_id = $1', [user_id]);
    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'User does not exist', status: 400 });
    }

    const book = await query('SELECT 1 FROM books WHERE book_id = $1', [book_id]);
    if (book.rows.length === 0) {
      return res.status(400).json({ error: 'Book does not exist', status: 400 });
    }

    const duplicate = await query(
      `
        SELECT 1 FROM reservations
        WHERE user_id = $1 AND book_id = $2 AND status IN ('pending', 'fulfilled')
      `,
      [user_id, book_id]
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Duplicate active reservation', status: 400 });
    }

    const result = await query(
      `
        INSERT INTO reservations (user_id, book_id, reserved_at, expires_at, status)
        VALUES ($1, $2, NOW(), NOW() + ($3 || ' days')::interval, 'pending')
        RETURNING reservation_id, user_id, book_id, reserved_at, expires_at, status
      `,
      [user_id, book_id, Number(expire_days)]
    );

    return res.status(201).json({ reservation: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/:reservation_id', async (req, res, next) => {
  try {
    const { status } = req.body || {};

    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status', status: 400 });
    }

    const result = await query(
      `
        UPDATE reservations
        SET status = $1, updated_at = NOW()
        WHERE reservation_id = $2
        RETURNING *
      `,
      [status, req.params.reservation_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found', status: 404 });
    }

    return res.json({ reservation: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
