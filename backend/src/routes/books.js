const express = require('express');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const AVAILABLE_COPIES_SUBQUERY = `
  (SELECT COUNT(*) FROM copies c
   WHERE c.book_id = b.id AND c.condition = 'good'
   AND NOT EXISTS (
     SELECT 1 FROM loans l WHERE l.copy_id = c.id AND l.return_date IS NULL
   ))
`;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// List books with availability, paginated. Any authenticated user.
// The catalogue is expected to grow to 50,000 books, so this never loads the
// whole table: it always applies LIMIT/OFFSET at the database level.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * pageSize;

    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE b.title ILIKE $1 OR b.author ILIKE $1 OR b.isbn ILIKE $1`;
    }

    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM books b ${where}`, params);
    const total = countResult.rows[0].total;

    const pageParams = [...params, pageSize, offset];
    const result = await pool.query(
      `SELECT b.id, b.isbn, b.title, b.author,
              ${AVAILABLE_COPIES_SUBQUERY} AS available_copies,
              (SELECT COUNT(*) FROM copies c WHERE c.book_id = b.id) AS total_copies
       FROM books b
       ${where}
       ORDER BY b.title
       LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
      pageParams
    );

    res.json({
      books: result.rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    next(err);
  }
});

// Book detail with its copies. Any authenticated user.
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const bookResult = await pool.query(
      `SELECT b.id, b.isbn, b.title, b.author, ${AVAILABLE_COPIES_SUBQUERY} AS available_copies
       FROM books b WHERE b.id = $1`,
      [req.params.id]
    );
    const book = bookResult.rows[0];
    if (!book) throw new ApiError(404, 'NOT_FOUND', 'Book not found.');

    const copiesResult = await pool.query(
      `SELECT c.id, c.copy_code, c.condition,
              EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.id AND l.return_date IS NULL) AS on_loan
       FROM copies c WHERE c.book_id = $1 ORDER BY c.copy_code`,
      [req.params.id]
    );
    res.json({ ...book, copies: copiesResult.rows });
  } catch (err) {
    next(err);
  }
});

// Create a book. Librarian only.
router.post('/', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const { isbn, title, author } = req.body;
    if (!isbn || !title || !author) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'isbn, title and author are required.');
    }
    const result = await pool.query(
      `INSERT INTO books (isbn, title, author) VALUES ($1, $2, $3) RETURNING *`,
      [isbn, title, author]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return next(new ApiError(409, 'ISBN_TAKEN', 'A book with that ISBN already exists.'));
    }
    next(err);
  }
});

// Update a book. Librarian only.
router.put('/:id', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const { isbn, title, author } = req.body;
    const result = await pool.query(
      `UPDATE books SET isbn = COALESCE($1, isbn), title = COALESCE($2, title), author = COALESCE($3, author)
       WHERE id = $4 RETURNING *`,
      [isbn, title, author, req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Book not found.');
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return next(new ApiError(409, 'ISBN_TAKEN', 'A book with that ISBN already exists.'));
    }
    next(err);
  }
});

// Delete a book. Librarian only. R8: a book that has ever been lent cannot be deleted.
router.delete('/:id', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const everLent = await pool.query(
      `SELECT 1 FROM loans l JOIN copies c ON c.id = l.copy_id WHERE c.book_id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (everLent.rows[0]) {
      throw new ApiError(409, 'BOOK_HAS_LOAN_HISTORY', 'A book that has ever been lent cannot be deleted.');
    }
    await pool.query(`DELETE FROM copies WHERE book_id = $1`, [req.params.id]);
    const result = await pool.query(`DELETE FROM books WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Book not found.');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Add a copy to a book. Librarian only.
router.post('/:id/copies', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const { copyCode, condition } = req.body;
    if (!copyCode) throw new ApiError(400, 'VALIDATION_ERROR', 'copyCode is required.');
    const bookExists = await pool.query('SELECT 1 FROM books WHERE id = $1', [req.params.id]);
    if (!bookExists.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Book not found.');
    const result = await pool.query(
      `INSERT INTO copies (book_id, copy_code, condition) VALUES ($1, $2, COALESCE($3, 'good')) RETURNING *`,
      [req.params.id, copyCode, condition]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return next(new ApiError(409, 'COPY_CODE_TAKEN', 'A copy with that copy code already exists.'));
    }
    next(err);
  }
});

module.exports = router;
