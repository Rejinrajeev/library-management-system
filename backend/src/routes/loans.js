const express = require('express');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { calculateFine, todayIST } = require('../utils/fine');

const router = express.Router();

const LOAN_SELECT = `
  SELECT l.id, l.member_id, l.copy_id, l.borrow_date, l.due_date, l.return_date,
         l.return_condition, l.fine_amount,
         b.id AS book_id, b.title, b.author, b.isbn, c.copy_code,
         u.name AS member_name, u.email AS member_email,
         (l.return_date IS NULL AND l.due_date < CURRENT_DATE) AS is_overdue
  FROM loans l
  JOIN copies c ON c.id = l.copy_id
  JOIN books b ON b.id = c.book_id
  JOIN users u ON u.id = l.member_id
`;

function withCurrentFine(loan) {
  const asOf = loan.return_date || todayIST();
  const { daysLate, fine } = calculateFine(loan.due_date, asOf);
  return {
    ...loan,
    current_fine: loan.fine_amount != null ? loan.fine_amount : fine,
    days_late: daysLate,
  };
}

// List loans. Members see only their own; librarians see all and may filter by status.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];

    if (req.user.role === 'member') {
      params.push(req.user.id);
      conditions.push(`l.member_id = $${params.length}`);
    } else if (req.query.memberId) {
      params.push(req.query.memberId);
      conditions.push(`l.member_id = $${params.length}`);
    }

    if (req.query.status === 'active') {
      conditions.push('l.return_date IS NULL');
    } else if (req.query.status === 'overdue') {
      conditions.push('l.return_date IS NULL AND l.due_date < CURRENT_DATE');
    } else if (req.query.status === 'returned') {
      conditions.push('l.return_date IS NOT NULL');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(`${LOAN_SELECT} ${where} ORDER BY l.borrow_date DESC, l.id DESC`, params);
    res.json(result.rows.map(withCurrentFine));
  } catch (err) {
    next(err);
  }
});

// Borrow a book. Member only. Assigns an available copy atomically (R2, R6).
router.post('/', requireAuth, requireRole('member'), async (req, res, next) => {
  const { bookId } = req.body;
  if (!bookId) throw new ApiError(400, 'VALIDATION_ERROR', 'bookId is required.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Serialize concurrent borrow attempts by the same member.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);

    const book = await client.query('SELECT id FROM books WHERE id = $1', [bookId]);
    if (!book.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Book not found.');

    const overdue = await client.query(
      `SELECT 1 FROM loans WHERE member_id = $1 AND return_date IS NULL AND due_date < CURRENT_DATE LIMIT 1`,
      [req.user.id]
    );
    if (overdue.rows[0]) {
      throw new ApiError(409, 'HAS_OVERDUE_LOAN', 'You cannot borrow while you have an overdue loan.');
    }

    const activeCount = await client.query(
      `SELECT COUNT(*)::int AS count FROM loans WHERE member_id = $1 AND return_date IS NULL`,
      [req.user.id]
    );
    if (activeCount.rows[0].count >= 3) {
      throw new ApiError(409, 'LOAN_LIMIT_REACHED', 'You already have 3 books on loan.');
    }

    const alreadyHasBook = await client.query(
      `SELECT 1 FROM loans l JOIN copies c ON c.id = l.copy_id
       WHERE l.member_id = $1 AND c.book_id = $2 AND l.return_date IS NULL LIMIT 1`,
      [req.user.id, bookId]
    );
    if (alreadyHasBook.rows[0]) {
      throw new ApiError(409, 'ALREADY_BORROWED', 'You already have this book on loan.');
    }

    // Lock one available copy; SKIP LOCKED means a concurrent request for the
    // last copy will not see a row this transaction already holds, so exactly
    // one of them succeeds (R6).
    const availableCopy = await client.query(
      `SELECT c.id FROM copies c
       WHERE c.book_id = $1 AND c.condition = 'good'
       AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.id AND l.return_date IS NULL)
       ORDER BY c.id
       FOR UPDATE OF c SKIP LOCKED
       LIMIT 1`,
      [bookId]
    );
    if (!availableCopy.rows[0]) {
      throw new ApiError(409, 'NO_COPY_AVAILABLE', 'No copy of this book is currently available.');
    }

    const loan = await client.query(
      `INSERT INTO loans (copy_id, member_id, borrow_date, due_date)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days')
       RETURNING *`,
      [availableCopy.rows[0].id, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json(loan.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Process a return. Librarian only (R7).
router.post('/:id/return', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const { condition } = req.body;
    if (!['good', 'damaged', 'lost'].includes(condition)) {
      throw new ApiError(400, 'VALIDATION_ERROR', "condition must be 'good', 'damaged' or 'lost'.");
    }

    const loanResult = await pool.query('SELECT * FROM loans WHERE id = $1', [req.params.id]);
    const loan = loanResult.rows[0];
    if (!loan) throw new ApiError(404, 'NOT_FOUND', 'Loan not found.');
    if (loan.return_date) throw new ApiError(409, 'ALREADY_RETURNED', 'This loan has already been returned.');

    const { fine } = calculateFine(loan.due_date, todayIST());

    const updated = await pool.query(
      `UPDATE loans SET return_date = CURRENT_DATE, return_condition = $1, fine_amount = $2
       WHERE id = $3 RETURNING *`,
      [condition, fine, req.params.id]
    );
    await pool.query('UPDATE copies SET condition = $1 WHERE id = $2', [condition, loan.copy_id]);

    res.json(updated.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
