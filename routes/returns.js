const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `
        SELECT return_id, issue_id, returned_by_user_id, returned_at, condition_notes, status
        FROM returns
        ORDER BY return_id ASC
      `
    );

    res.json({ returns: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:return_id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM returns WHERE return_id = $1', [req.params.return_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Return record not found', status: 404 });
    }

    return res.json({ return: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { issue_id, returned_by_user_id, condition_notes } = req.body || {};

    if (!issue_id) {
      return res.status(400).json({ error: 'Missing required field: issue_id', status: 400 });
    }

    if (!returned_by_user_id) {
      return res.status(400).json({ error: 'Missing required field: returned_by_user_id', status: 400 });
    }

    const issueExists = await query('SELECT * FROM issues WHERE issue_id = $1', [issue_id]);
    if (issueExists.rows.length === 0) {
      return res.status(400).json({ error: 'Issue does not exist', status: 400 });
    }

    const issue = issueExists.rows[0];
    if (issue.status === 'completed') {
      return res.status(400).json({ error: 'Issue already completed', status: 400 });
    }

    const userExists = await query('SELECT 1 FROM users WHERE user_id = $1 AND role = $2', [returned_by_user_id, 'librarian']);
    if (userExists.rows.length === 0) {
      return res.status(400).json({ error: 'returned_by_user_id must be a librarian', status: 400 });
    }

    const returnResult = await query(
      `
        INSERT INTO returns (issue_id, returned_by_user_id, returned_at, condition_notes, status)
        VALUES ($1, $2, NOW(), $3, 'completed')
        RETURNING *
      `,
      [issue_id, returned_by_user_id, condition_notes || null]
    );

    await query(
      `
        UPDATE issues
        SET status = 'completed', returned_at = NOW(), updated_at = NOW()
        WHERE issue_id = $1
      `,
      [issue_id]
    );

    await query(
      `
        UPDATE books
        SET status = 'available', updated_at = NOW()
        WHERE book_id = (
          SELECT book_id FROM issues WHERE issue_id = $1
        )
      `,
      [issue_id]
    );

    return res.status(201).json({ return: returnResult.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
