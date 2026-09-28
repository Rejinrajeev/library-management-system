const express = require('express');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireIdParam } = require('../utils/validate');

const router = express.Router();

const AVAILABLE_COPIES_SUBQUERY = `
  (SELECT COUNT(*) FROM copies c
   WHERE c.book_id = b.id AND c.condition = 'good'
   AND NOT EXISTS (
     SELECT 1 FROM loans l WHERE l.copy_id = c.id AND l.return_date IS NULL
   ))
`;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MIN_ISBN_DIGITS = 13;
const MAX_ISBN_LENGTH = 32;
const MAX_TITLE_LENGTH = 200;
const MAX_AUTHOR_LENGTH = 200;
const MAX_COPY_CODE_LENGTH = 50;

// Trims a required string field and rejects it if empty or too long.
function cleanRequired(value, fieldName, maxLength) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) throw new ApiError(400, 'VALIDATION_ERROR', `${fieldName} is required.`);
  if (trimmed.length > maxLength) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldName} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

// Trims an optional string field; returns undefined if not supplied (or blank)
// so callers can treat it as "unchanged" / "use the default".
function cleanOptional(value, fieldName, maxLength) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldName} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

// isbn must contain at least 13 digits (hyphens/spaces are allowed as
// formatting, e.g. "978-0-13-235088-4", but don't count toward the length).
function validateIsbn(trimmed) {
  const digitsOnly = trimmed.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digitsOnly) || digitsOnly.length < MIN_ISBN_DIGITS) {
    throw new ApiError(400, 'VALIDATION_ERROR', `isbn must contain at least ${MIN_ISBN_DIGITS} digits.`);
  }
}

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
router.get('/:id', requireAuth, requireIdParam(), async (req, res, next) => {
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

// Create a book, optionally with its initial copies. Librarian only.
router.post('/', requireAuth, requireRole('librarian'), async (req, res, next) => {
  let client;
  try {
    const isbn = cleanRequired(req.body.isbn, 'isbn', MAX_ISBN_LENGTH);
    validateIsbn(isbn);
    const title = cleanRequired(req.body.title, 'title', MAX_TITLE_LENGTH);
    const author = cleanRequired(req.body.author, 'author', MAX_AUTHOR_LENGTH);

    const { numberOfCopies, copyCondition } = req.body;
    const copyCount = numberOfCopies === undefined || numberOfCopies === '' ? 1 : parseInt(numberOfCopies, 10);
    if (!Number.isInteger(copyCount) || copyCount < 0 || copyCount > 100) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'numberOfCopies must be a whole number between 0 and 100.');
    }
    const condition = copyCondition || 'good';
    if (!['good', 'damaged', 'lost'].includes(condition)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'copyCondition must be good, damaged or lost.');
    }
    const codePrefix = cleanOptional(req.body.copyCodePrefix, 'copyCodePrefix', MAX_COPY_CODE_LENGTH) || isbn;

    client = await pool.connect();
    await client.query('BEGIN');

    const bookResult = await client.query(
      `INSERT INTO books (isbn, title, author) VALUES ($1, $2, $3) RETURNING *`,
      [isbn, title, author]
    );
    const book = bookResult.rows[0];

    const copies = [];
    for (let i = 1; i <= copyCount; i += 1) {
      const copyResult = await client.query(
        `INSERT INTO copies (book_id, copy_code, condition) VALUES ($1, $2, $3) RETURNING *`,
        [book.id, `${codePrefix}-${i}`, condition]
      );
      copies.push(copyResult.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ...book, copies });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    if (err.code === '23505') {
      return next(new ApiError(409, 'ISBN_TAKEN', 'A book with that ISBN already exists.'));
    }
    next(err);
  } finally {
    if (client) client.release();
  }
});

// Update a book. Librarian only. Any of isbn/title/author may be supplied.
router.put('/:id', requireAuth, requireRole('librarian'), requireIdParam(), async (req, res, next) => {
  try {
    const isbn = cleanOptional(req.body.isbn, 'isbn', MAX_ISBN_LENGTH);
    if (isbn !== undefined) validateIsbn(isbn);
    const title = cleanOptional(req.body.title, 'title', MAX_TITLE_LENGTH);
    const author = cleanOptional(req.body.author, 'author', MAX_AUTHOR_LENGTH);
    const result = await pool.query(
      `UPDATE books SET isbn = COALESCE($1, isbn), title = COALESCE($2, title), author = COALESCE($3, author)
       WHERE id = $4 RETURNING *`,
      [isbn ?? null, title ?? null, author ?? null, req.params.id]
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
router.delete('/:id', requireAuth, requireRole('librarian'), requireIdParam(), async (req, res, next) => {
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
router.post('/:id/copies', requireAuth, requireRole('librarian'), requireIdParam(), async (req, res, next) => {
  try {
    const copyCode = cleanRequired(req.body.copyCode, 'copyCode', MAX_COPY_CODE_LENGTH);
    const condition = req.body.condition || 'good';
    if (!['good', 'damaged', 'lost'].includes(condition)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'condition must be good, damaged or lost.');
    }
    const bookExists = await pool.query('SELECT 1 FROM books WHERE id = $1', [req.params.id]);
    if (!bookExists.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Book not found.');
    const result = await pool.query(
      `INSERT INTO copies (book_id, copy_code, condition) VALUES ($1, $2, $3) RETURNING *`,
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
