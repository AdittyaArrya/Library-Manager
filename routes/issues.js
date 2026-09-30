const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `
        SELECT issue_id, user_id, book_id, issued_at, due_at, status, returned_at
        FROM issues
        ORDER BY issue_id ASC
      `
    );

    res.json({ issues: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:issue_id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM issues WHERE issue_id = $1', [req.params.issue_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found', status: 404 });
    }

    return res.json({ issue: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/user/:user_id', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM issues WHERE user_id = $1 ORDER BY issue_id ASC',
      [req.params.user_id]
    );

    return res.json({ issues: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { user_id, book_id, due_days } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ error: 'Missing required field: user_id', status: 400 });
    }

    if (!book_id) {
      return res.status(400).json({ error: 'Missing required field: book_id', status: 400 });
    }

    if (!due_days) {
      return res.status(400).json({ error: 'Missing required field: due_days', status: 400 });
    }

    const user = await query('SELECT 1 FROM users WHERE user_id = $1', [user_id]);
    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'User does not exist', status: 400 });
    }

    const book = await query('SELECT book_id, status FROM books WHERE book_id = $1', [book_id]);
    if (book.rows.length === 0) {
      return res.status(400).json({ error: 'Book does not exist', status: 400 });
    }

    if (book.rows[0].status !== 'available') {
      return res.status(400).json({ error: 'Book is not available', status: 400 });
    }

    const issuedAt = new Date();
    const dueAt = new Date(issuedAt.getTime() + Number(due_days) * 24 * 60 * 60 * 1000);

    const result = await query(
      `
        INSERT INTO issues (user_id, book_id, issued_at, due_at, status, returned_at)
        VALUES ($1, $2, NOW(), NOW() + ($3 || ' days')::interval, 'pending', NULL)
        RETURNING issue_id, user_id, book_id, issued_at, due_at, status, returned_at
      `,
      [user_id, book_id, Number(due_days)]
    );

    await query("UPDATE books SET status = 'issued', updated_at = NOW() WHERE book_id = $1", [book_id]);

    return res.status(201).json({ issue: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/:issue_id', async (req, res, next) => {
  try {
    const { status } = req.body || {};

    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status', status: 400 });
    }

    const result = await query(
      `
        UPDATE issues
        SET status = $1, updated_at = NOW()
        WHERE issue_id = $2
        RETURNING *
      `,
      [status, req.params.issue_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found', status: 404 });
    }

    return res.json({ issue: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
