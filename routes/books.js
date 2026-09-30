const express = require('express');
const router = express.Router();
const { query } = require('../db');

function normalizeBook(row) {
  return {
    book_id: row.book_id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    status: row.status,
    category_id: row.category_id,
    publisher: row.publisher,
    publication_year: row.publication_year,
    created_at: row.created_at,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { status, category_id, search } = req.query;

    let sql = `
      SELECT book_id, title, author, isbn, status, category_id
      FROM books
    `;
    const params = [];

    if (status || category_id || search) {
      const clauses = [];

      if (status) {
        clauses.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      if (category_id) {
        clauses.push(`category_id = $${params.length + 1}`);
        params.push(category_id);
      }

      if (search) {
        clauses.push(`(LOWER(title) LIKE LOWER($${params.length + 1}) OR LOWER(author) LIKE LOWER($${params.length + 1}))`);
        params.push(`%${search}%`);
      }

      if (clauses.length > 0) {
        sql += ` WHERE ${clauses.join(' AND ')}`;
      }
    }

    sql += ' ORDER BY book_id ASC';

    const result = await query(sql, params);
    res.json({ books: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.json({ books: [] });
    }

    const result = await query(
      `
        SELECT book_id, title, author, isbn, status, category_id
        FROM books
        WHERE LOWER(title) LIKE LOWER($1)
           OR LOWER(author) LIKE LOWER($1)
        ORDER BY book_id ASC
      `,
      [`%${q}%`]
    );

    return res.json({ books: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/:book_id', async (req, res, next) => {
  try {
    const { book_id } = req.params;
    const result = await query(
      `
        SELECT book_id, title, author, isbn, publisher, publication_year, status, category_id, created_at
        FROM books
        WHERE book_id = $1
      `,
      [book_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found', status: 404 });
    }

    return res.json({ book: normalizeBook(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { category_id, isbn, title, author, publisher, publication_year } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: 'Missing required field: title', status: 400 });
    }

    if (!category_id) {
      return res.status(400).json({ error: 'Missing required field: category_id', status: 400 });
    }

    if (!isbn) {
      return res.status(400).json({ error: 'Missing required field: isbn', status: 400 });
    }

    const categoryResult = await query('SELECT 1 FROM categories WHERE category_id = $1', [category_id]);
    if (categoryResult.rows.length === 0) {
      return res.status(400).json({ error: 'Category does not exist', status: 400 });
    }

    const duplicate = await query('SELECT 1 FROM books WHERE isbn = $1', [isbn]);
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'ISBN must be unique', status: 400 });
    }

    const result = await query(
      `
        INSERT INTO books (category_id, isbn, title, author, publisher, publication_year, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'available')
        RETURNING *
      `,
      [category_id, isbn, title, author, publisher || null, publication_year || null]
    );

    return res.status(201).json({ book: normalizeBook(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.put('/:book_id', async (req, res, next) => {
  try {
    const { book_id } = req.params;
    const { title, author, status } = req.body || {};

    const updates = [];
    const values = [];

    if (typeof title !== 'undefined') {
      updates.push(`title = $${updates.length + 1}`);
      values.push(title);
    }

    if (typeof author !== 'undefined') {
      updates.push(`author = $${updates.length + 1}`);
      values.push(author);
    }

    if (typeof status !== 'undefined') {
      updates.push(`status = $${updates.length + 1}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update', status: 400 });
    }

    values.push(book_id);

    const result = await query(
      `
        UPDATE books
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE book_id = $${values.length}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found', status: 404 });
    }

    return res.json({ book: normalizeBook(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
