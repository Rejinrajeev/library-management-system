const express = require('express');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// List reservations. Members see their own with queue position; librarians see all.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.user.role === 'member') {
      params.push(req.user.id);
      where = `WHERE r.member_id = $${params.length}`;
    } else if (req.query.bookId) {
      params.push(req.query.bookId);
      where = `WHERE r.book_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT r.id, r.book_id, b.title, b.author, r.member_id, u.name AS member_name,
              r.created_at, r.fulfilled_at,
              (SELECT COUNT(*) FROM reservations r2
               WHERE r2.book_id = r.book_id AND r2.fulfilled_at IS NULL AND r2.created_at <= r.created_at
              )::int AS queue_position
       FROM reservations r
       JOIN books b ON b.id = r.book_id
       JOIN users u ON u.id = r.member_id
       ${where}
       ORDER BY r.fulfilled_at IS NULL DESC, r.created_at ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Reserve a book. Member only. Only allowed when no copy is currently available.
router.post('/', requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    const { bookId } = req.body;
    if (!bookId) throw new ApiError(400, 'VALIDATION_ERROR', 'bookId is required.');

    const book = await pool.query('SELECT 1 FROM books WHERE id = $1', [bookId]);
    if (!book.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Book not found.');

    const available = await pool.query(
      `SELECT 1 FROM copies c
       WHERE c.book_id = $1 AND c.condition = 'good'
       AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.id AND l.return_date IS NULL)
       LIMIT 1`,
      [bookId]
    );
    if (available.rows[0]) {
      throw new ApiError(409, 'COPY_AVAILABLE', 'A copy is available; borrow it instead of reserving.');
    }

    const alreadyHasBook = await pool.query(
      `SELECT 1 FROM loans l JOIN copies c ON c.id = l.copy_id
       WHERE l.member_id = $1 AND c.book_id = $2 AND l.return_date IS NULL LIMIT 1`,
      [req.user.id, bookId]
    );
    if (alreadyHasBook.rows[0]) {
      throw new ApiError(409, 'ALREADY_BORROWED', 'You already have this book on loan.');
    }

    const alreadyReserved = await pool.query(
      `SELECT 1 FROM reservations WHERE member_id = $1 AND book_id = $2 AND fulfilled_at IS NULL LIMIT 1`,
      [req.user.id, bookId]
    );
    if (alreadyReserved.rows[0]) {
      throw new ApiError(409, 'ALREADY_RESERVED', 'You already have an active reservation for this book.');
    }

    const result = await pool.query(
      `INSERT INTO reservations (book_id, member_id) VALUES ($1, $2) RETURNING *`,
      [bookId, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return next(new ApiError(409, 'ALREADY_RESERVED', 'You already have an active reservation for this book.'));
    }
    next(err);
  }
});

module.exports = router;
